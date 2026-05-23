import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { ComposedChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Bar, Line, Scatter, ReferenceLine } from 'recharts'
import {
  ECOLI_GMV30_SERIES_NAME,
  FECAL_GMV30_SERIES_NAME,
  ECOLI_OBSERVATIONS_SERIES_NAME,
  FECAL_OBSERVATIONS_SERIES_NAME,
  ECOLI_THRESHOLD_SERIES_NAME,
  ECOLI_THRESHOLD_SHAPE,
  ECOLI_P90_LIMIT_COLOR,
  FECAL_THRESHOLD_SERIES_NAME,
  FECAL_P90_LIMIT_COLOR,
  LEGEND_PAYLOAD,
  FECAL_THRESHOLD_SHAPE,
  FECAL_GMV30_STYLE,
  ECOLI_GMV_LIMIT_VALUE,
  ECOLI_GMV_LIMIT_NAME,
  ECOLI_GMV_LIMIT_STYLE,
  ECOLI_P90_LIMIT_VALUE,
  FECAL_P90_LIMIT_VALUE,
  FECAL_GMV_LIMIT_VALUE,
  FECAL_GMV_LIMIT_NAME,
  FECAL_GMV_LIMIT_STYLE,
} from './chartSeries'

// const DATA_PATH = '/data'
const DATA_PATH = import.meta.env.BASE_URL + 'data' // Adjusted for Vite's base path handling
const CSV_FILES = {
  stations: `${DATA_PATH}/station_lookup.csv`,
  precip: `${DATA_PATH}/precip_filtered.csv`,
  ecoli: `${DATA_PATH}/kphd_ecoli_filtered.csv`,
  fecal: `${DATA_PATH}/wa_doh_fc_filtered.csv`,
}

const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return date.toISOString().slice(0, 10)
}

const parseDate = (raw) => {
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const quantile = (values, q) => {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) return NaN
  const pos = (sorted.length - 1) * q
  const lower = Math.floor(pos)
  const upper = Math.ceil(pos)
  if (upper === lower) return sorted[lower]
  const weight = pos - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

const geometricMean = (values) => {
  if (values.length === 0 || values.some((value) => value <= 0)) return NaN
  const sum = values.reduce((acc, value) => acc + Math.log(value), 0)
  return Math.exp(sum / values.length)
}

const standardDeviation = (values) => {
  if (values.length < 2) return NaN
  const mean = values.reduce((acc, value) => acc + value, 0) / values.length
  const variance = values.reduce((acc, value) => acc + ((value - mean) ** 2), 0) / (values.length - 1)
  return Math.sqrt(variance)
}

const lognormalPercentile = (values, zScore) => {
  if (values.length < 2 || values.some((value) => value <= 0)) return NaN
  const logValues = values.map((value) => Math.log(value))
  const logMean = logValues.reduce((acc, value) => acc + value, 0) / logValues.length
  const logSd = standardDeviation(logValues)
  return Math.exp(logMean + (zScore * logSd))
}

const collapseDaily = (rows) => {
  const group = new Map()
  rows.forEach((row) => {
    const day = row.Date.toISOString().slice(0, 10)
    const existing = group.get(day)
    if (!existing) {
      group.set(day, {
        ...row,
        Date: row.Date,
        sum: row.Value,
        count: 1,
      })
    } else {
      existing.sum += row.Value
      existing.count += 1
    }
  })
  return Array.from(group.values())
    .map((item) => ({
      ...item,
      Value: item.sum / item.count,
      Count: item.count,
      sum: undefined,
      count: undefined,
    }))
    .sort((a, b) => a.Date - b.Date)
}

const addRollingStats = (rows, threshold, window = 30, exceedanceMethod = 'lognormal') => {
  const out = rows.map((row) => ({ ...row, GMV30: NaN, P90_30: NaN, P90_LN_30: NaN, Exceeds_RegThreshold: false, Crosses_Above_Threshold: false, Crosses_Below_Threshold: false }))
  for (let index = 0; index < out.length; index += 1) {
    const windowRows = out.slice(Math.max(0, index - window + 1), index + 1)
    if (windowRows.length === window) {
      const values = windowRows.map((row) => row.Value)
      const gmv = geometricMean(values)
      const p90 = quantile(values, 0.9)
      const p90Ln = lognormalPercentile(values, 1.2815515655446004)
      out[index].GMV30 = Number.isNaN(gmv) ? null : gmv
      out[index].P90_30 = Number.isNaN(p90) ? null : p90
      out[index].P90_LN_30 = Number.isNaN(p90Ln) ? null : p90Ln
      const exceedanceValue = exceedanceMethod === 'raw' ? p90 : p90Ln
      out[index].Exceeds_RegThreshold = exceedanceValue > threshold
    }
    if (index > 0 && out[index].P90_30 != null && out[index - 1].P90_30 != null) {
      out[index].Crosses_Above_Threshold = out[index].Exceeds_RegThreshold && !out[index - 1].Exceeds_RegThreshold
      out[index].Crosses_Below_Threshold = !out[index].Exceeds_RegThreshold && out[index - 1].Exceeds_RegThreshold
    }
  }
  return out
}

const formatNumber = (value, digits = 2) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue.toFixed(digits) : ''
}

const formatTooltipValue = (value) => (typeof value === 'number' ? value.toFixed(2) : value)

const KPH_D_ECOLI_OBSERVATION_COLOR = '#2ca02c'
const KPH_D_FECAL_OBSERVATION_COLOR = '#98df8a'

const KphdObservationShape = ({ cx, cy, payload }) => (
  <circle
    cx={cx}
    cy={cy}
    r={4}
    fill={payload?.Constituent === 'Fecal Coliform' ? KPH_D_FECAL_OBSERVATION_COLOR : KPH_D_ECOLI_OBSERVATION_COLOR}
  />
)

const toTimeKey = (date) => date.toISOString().slice(0, 10)

const createChartSeries = (precip, ecoliStats, fecalStats, start, end) => {
  const dateMap = new Map()
  precip.forEach((row) => {
    const key = toTimeKey(row.Date)
    if (row.Date < start || row.Date > end) return
    dateMap.set(key, {
      date: row.Date.getTime(),
      Precip_in: row.Precip_in,
      EcoliValue: null,
      EcoliGMV: null,
      FecalValue: null,
      FecalGMV: null,
    })
  })

  const ensureDateObject = (point) => {
    const key = toTimeKey(point.Date)
    if (!dateMap.has(key)) {
      dateMap.set(key, {
        date: point.Date.getTime(),
        Precip_in: 0,
        EcoliValue: null,
        EcoliGMV: null,
        FecalValue: null,
        FecalGMV: null,
      })
    }
    return dateMap.get(key)
  }

  ecoliStats.forEach((row) => {
    if (row.Date < start || row.Date > end) return
    const existing = ensureDateObject(row)
    existing.EcoliValue = row.Value
    existing.EcoliGMV = row.GMV30
  })
  fecalStats.forEach((row) => {
    if (row.Date < start || row.Date > end) return
    const existing = ensureDateObject(row)
    existing.FecalValue = row.Value
    existing.FecalGMV = row.GMV30
  })

  return Array.from(dateMap.values()).sort((a, b) => a.date - b.date)
}

const loadCsv = async (url) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Unable to load ${url}`)
  const text = await response.text()
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
  return parsed.data
}

const App = () => {
  const [stations, setStations] = useState([])
  const [precip, setPrecip] = useState([])
  const [ecoli, setEcoli] = useState([])
  const [fecal, setFecal] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selectedStation, setSelectedStation] = useState('')
  const [startYear, setStartYear] = useState(2021)
  const [endYear, setEndYear] = useState(2025)
  const [useAllDataForGMVs, setUseAllDataForGMVs] = useState(false)
  const [percentileExceedanceMethod, setPercentileExceedanceMethod] = useState('lognormal')
  const [chartData, setChartData] = useState(null)
  const [selectedStationDetails, setSelectedStationDetails] = useState(null)

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [stationsCsv, precipCsv, ecoliCsv, fecalCsv] = await Promise.all([
          loadCsv(CSV_FILES.stations),
          loadCsv(CSV_FILES.precip),
          loadCsv(CSV_FILES.ecoli),
          loadCsv(CSV_FILES.fecal),
        ])

        const stationRows = stationsCsv.map((row) => ({
          ...row,
          WADOHStation: row.WADOHStation ? row.WADOHStation.trim() : '',
          DisplayName: row.DisplayName?.trim() || row.Catchment?.trim(),
        }))

        setStations(stationRows)
        if (!selectedStation && stationRows.length > 0) {
          setSelectedStation(stationRows[0].Catchment)
          setSelectedStationDetails(stationRows[0])
        }

        setPrecip(
          precipCsv
            .map((row) => ({
              Date: parseDate(row.Date),
              Precip_in: Number(row.Precip_in),
            }))
            .filter((row) => row.Date && !Number.isNaN(row.Precip_in)),
        )

        setEcoli(
          ecoliCsv
            .map((row) => ({
              Catchment: row.Catchment,
              Constituent: row.Constituent,
              Units: row.Units,
              Date: parseDate(row.Date),
              Value: Number(row.Value),
            }))
            .filter((row) => row.Catchment && row.Date && !Number.isNaN(row.Value)),
        )

        setFecal(
          fecalCsv
            .map((row) => ({
              Catchment: row.Catchment,
              Constituent: row.Constituent,
              Units: row.Units,
              Date: parseDate(row.Date),
              Value: Number(row.Value),
            }))
            .filter((row) => row.Catchment && row.Date && !Number.isNaN(row.Value)),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    loadAll()
  }, [])

  useEffect(() => {
    if (!selectedStation) return
    const station = stations.find((row) => row.Catchment === selectedStation)
    setSelectedStationDetails(station || null)
  }, [selectedStation, stations])

  const years = useMemo(() => {
    const yearSet = new Set()
    precip.forEach((row) => yearSet.add(row.Date.getFullYear()))
    const allYears = Array.from(yearSet).sort((a, b) => a - b)
    return allYears.length > 0 ? allYears : [2021, 2022, 2023, 2024, 2025]
  }, [precip])

  const stationOptions = useMemo(
    () => stations.map((row) => ({ label: row.DisplayName, value: row.Catchment })),
    [stations],
  )

  const availableYears = useMemo(() => {
    const uniqueYears = Array.from(new Set(years)).sort((a, b) => a - b)
    return uniqueYears
  }, [years])

  const yearTicks = useMemo(() => {
    const ticks = []
    for (let year = startYear; year <= endYear; year += 1) {
      ticks.push(Date.UTC(year, 0, 1))
    }
    return ticks
  }, [startYear, endYear])

  const hasFecalData = useMemo(
    () => selectedStationDetails?.WADOHStation, [selectedStationDetails],
  )


  const generate = () => {
    if (!selectedStation) return
    const stationEcoli = ecoli.filter((row) => row.Catchment === selectedStation)
    const stationFecal = fecal.filter((row) => row.Catchment === selectedStation)
    const collapsedEcoli = collapseDaily(stationEcoli)
    const collapsedFecal = collapseDaily(stationFecal)

    const gmvStart = new Date(Date.UTC(startYear, 0, 1))
    const gmvEnd = new Date(Date.UTC(endYear, 11, 31))

    const ecoliForStats = useAllDataForGMVs
      ? collapsedEcoli.filter((row) => row.Date <= gmvEnd)
      : collapsedEcoli.filter((row) => row.Date >= gmvStart && row.Date <= gmvEnd)

    const fecalForStats = useAllDataForGMVs
      ? collapsedFecal.filter((row) => row.Date <= gmvEnd)
      : collapsedFecal.filter((row) => row.Date >= gmvStart && row.Date <= gmvEnd)

    const ecoliStats = addRollingStats(ecoliForStats, ECOLI_P90_LIMIT_VALUE, 30, percentileExceedanceMethod)
    const fecalStats = addRollingStats(fecalForStats, FECAL_P90_LIMIT_VALUE, 30, percentileExceedanceMethod)

    const filteredPrecip = precip.filter((row) => {
      const year = row.Date.getFullYear()
      return year >= startYear && year <= endYear
    })
    const rangeStart = new Date(Date.UTC(startYear, 0, 1))
    const rangeEnd = new Date(Date.UTC(endYear, 11, 31))

    const sampleEcoliStats = ecoliStats
      .map((row) => ({ ...row, date: row.Date.getTime() }))
      .filter((row) => row.date >= rangeStart.getTime() && row.date <= rangeEnd.getTime())
    const sampleFecalStats = fecalStats
      .map((row) => ({ ...row, date: row.Date.getTime() }))
      .filter((row) => row.date >= rangeStart.getTime() && row.date <= rangeEnd.getTime())
    const kphdTableRows = addRollingStats(
      useAllDataForGMVs
        ? collapsedEcoli
          .filter((row) => row.Date <= rangeEnd)
          .sort((a, b) => a.Date - b.Date)
        : collapsedEcoli
          .filter((row) => row.Date >= rangeStart && row.Date <= rangeEnd)
          .sort((a, b) => a.Date - b.Date),
      ECOLI_P90_LIMIT_VALUE,
      30,
      percentileExceedanceMethod,
    )
      .map((row) => ({ ...row, date: row.Date.getTime() }))
      .filter((row) => row.Date >= rangeStart && row.Date <= rangeEnd)
      .sort((a, b) => b.Date - a.Date)
    const waDohTableRows = addRollingStats(
      useAllDataForGMVs
        ? collapsedFecal
          .filter((row) => row.Date <= rangeEnd)
          .sort((a, b) => a.Date - b.Date)
        : collapsedFecal
          .filter((row) => row.Date >= rangeStart && row.Date <= rangeEnd)
          .sort((a, b) => a.Date - b.Date),
      FECAL_P90_LIMIT_VALUE,
      30,
      percentileExceedanceMethod,
    )
      .map((row) => ({ ...row, date: row.Date.getTime() }))
      .filter((row) => row.Date >= rangeStart && row.Date <= rangeEnd)
      .sort((a, b) => b.Date - a.Date)
    const ecoliThresholdExceedances = kphdTableRows.filter((row) => row.Exceeds_RegThreshold)
    const fecalThresholdExceedances = waDohTableRows.filter((row) => row.Exceeds_RegThreshold)
    const chartSeries = createChartSeries(filteredPrecip, ecoliStats, fecalStats, rangeStart, rangeEnd)
    const observedValues = [...sampleEcoliStats, ...sampleFecalStats]
      .map((row) => row.Value)
      .filter((value) => Number.isFinite(value) && value > 0)
    const maxObservedValue = observedValues.length > 0 ? Math.max(...observedValues) : 1

    setChartData({
      chartSeries,
      ecoliStats: sampleEcoliStats,
      fecalStats: sampleFecalStats,
      ecoliGmvSeries: sampleEcoliStats
        .filter((row) => row.GMV30 != null)
        .map((row) => ({ ...row, EcoliGMV: row.GMV30 })),
      fecalGmvSeries: sampleFecalStats
        .filter((row) => row.GMV30 != null)
        .map((row) => ({ ...row, FecalGMV: row.GMV30 })),
      ecoliObservationSeries: sampleEcoliStats
        .filter((row) => row.Value != null)
        .map((row) => ({ ...row, EcoliValue: row.Value })),
      fecalObservationSeries: sampleFecalStats
        .filter((row) => row.Value != null)
        .map((row) => ({ ...row, FecalValue: row.Value })),
      ecoliThresholdExceedances,
      fecalThresholdExceedances,
      kphdTableRows,
      waDohTableRows,
      leftAxisMax: Math.max(1, maxObservedValue * 1.05),
      hasFecalData: Boolean(stationFecal.length),
      showKphdFecalNote: startYear < 2020,
    })
  }

  if (loading) {
    return <div className="app-shell"><h1>Monitoring Paired Data App</h1><p>Loading data…</p></div>
  }

  if (error) {
    return <div className="app-shell"><h1>Error</h1><p>{error}</p></div>
  }

  return (
    <div className="app-shell">
      <h1>Monitoring Paired Data App</h1>
      <section className="controls">
        <div className="control-row">
          <label htmlFor="station">Select station pair</label>
          <select
            id="station"
            value={selectedStation}
            onChange={(event) => setSelectedStation(event.target.value)}
          >
            {stationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="control-row year-row">
          <div>
            <label htmlFor="start-year">Start year</label>
            <select id="start-year" value={startYear} onChange={(event) => setStartYear(Number(event.target.value))}>
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="end-year">End year</label>
            <select id="end-year" value={endYear} onChange={(event) => setEndYear(Number(event.target.value))}>
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="control-row">
          <label>
            <input
              type="checkbox"
              checked={useAllDataForGMVs}
              onChange={(event) => setUseAllDataForGMVs(event.target.checked)}
            />
            {' '}
            Use all data for GMVs
          </label>
          <p style={{ margin: '6px 0 0', color: '#556170', fontSize: '0.92rem' }}>
            When checked, GMV values are computed using earlier data before the selected start year.
          </p>
        </div>

        <div className="control-row">
          <span className="control-label">For 90% exceedance checks, use</span>
          <div className="radio-group" role="radiogroup" aria-label="90% exceedance check method">
            <label>
              <input
                type="radio"
                name="percentile-exceedance-method"
                value="lognormal"
                checked={percentileExceedanceMethod === 'lognormal'}
                onChange={(event) => setPercentileExceedanceMethod(event.target.value)}
              />
              Estimated 90%ile based on a lognormal distribution
            </label>
            <label>
              <input
                type="radio"
                name="percentile-exceedance-method"
                value="raw"
                checked={percentileExceedanceMethod === 'raw'}
                onChange={(event) => setPercentileExceedanceMethod(event.target.value)}
              />
              Raw rolling 90%ile from observation values
            </label>
          </div>
        </div>

        <button onClick={generate} className="generate-button">
          Generate chart
        </button>

        <div className="info-panel">
          <p>
            Selecting <strong>{selectedStationDetails?.DisplayName}</strong>.
            {hasFecalData ? ' Fecal coliform data is available.' : ' No WA DOH fecal coliform station is available for this catchment.'}
          </p>
        </div>
      </section>

      {chartData ? (
        <section className="chart-panel">
          <h2>Paired monitoring sites: {selectedStationDetails?.DisplayName}</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={540}>
              <ComposedChart data={chartData.chartSeries} margin={{ top: 5, right: 18, bottom: 5, left: 23 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  ticks={yearTicks}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    return Number.isNaN(date.getTime()) ? '' : date.getUTCFullYear()
                  }}
                  interval={0}
                  scale="time"
                />
                <YAxis
                  yAxisId="left"
                  scale="log"
                  domain={[1, chartData.leftAxisMax]}
                  allowDataOverflow={true}
                  tickFormatter={(value) => (value >= 1 ? value.toString() : '')}
                  label={{
                    value: 'E. coli (cfu/100mL) / Fecal Coliform (colonies/100mL)',
                    angle: -90,
                    position: 'insideLeft',
                    offset: -9,
                    style: { textAnchor: 'middle', fill: '#1a1a1a' },
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={['dataMax', 0]}
                  tickFormatter={(value) => value.toFixed(2)}
                  label={{
                    value: 'Precipitation (inches)',
                    angle: 90,
                    position: 'insideRight',
                    offset: -13,
                    style: { textAnchor: 'middle', fill: '#1a1a1a' },
                  }}
                />
                <Tooltip
                  labelFormatter={(value) => formatDate(value)}
                  formatter={(value, name) => [formatTooltipValue(value), name]}
                />
                <Legend
                  payload={chartData.hasFecalData
                    ? LEGEND_PAYLOAD.filter((item) => (
                      (item.value !== ECOLI_THRESHOLD_SERIES_NAME || chartData.ecoliThresholdExceedances.length > 0)
                      && (item.value !== FECAL_THRESHOLD_SERIES_NAME || chartData.fecalThresholdExceedances.length > 0)
                    ))
                    : LEGEND_PAYLOAD.filter((item) => (
                      (item.value !== ECOLI_THRESHOLD_SERIES_NAME || chartData.ecoliThresholdExceedances.length > 0)
                      && ![
                      FECAL_GMV30_SERIES_NAME,
                      FECAL_GMV_LIMIT_NAME,
                      FECAL_OBSERVATIONS_SERIES_NAME,
                      FECAL_THRESHOLD_SERIES_NAME,
                    ].includes(item.value)
                    ))}
                />

                <Bar dataKey="Precip_in" barSize={2} barCategoryGap="2%" fill="#1f77b4" opacity={0.25} yAxisId="right" />
                <Line
                  yAxisId="left"
                  type="linear"
                  data={chartData.ecoliGmvSeries}
                  dataKey="EcoliGMV"
                  stroke="#2ca02c"
                  strokeWidth={3}
                  name={ECOLI_GMV30_SERIES_NAME}
                  dot={false}
                  connectNulls={true}
                />
                {chartData.hasFecalData && (
                  <Line
                    yAxisId="left"
                    type="linear"
                    data={chartData.fecalGmvSeries}
                    dataKey="FecalGMV"
                    stroke={FECAL_GMV30_STYLE.stroke}
                    strokeWidth={FECAL_GMV30_STYLE.strokeWidth}
                    strokeDasharray={FECAL_GMV30_STYLE.strokeDasharray}
                    name={FECAL_GMV30_SERIES_NAME}
                    dot={false}
                    connectNulls={true}
                  />
                )}
                {ECOLI_GMV_LIMIT_VALUE <= chartData.leftAxisMax && (
                  <ReferenceLine
                    y={ECOLI_GMV_LIMIT_VALUE}
                    yAxisId="left"
                    stroke={ECOLI_GMV_LIMIT_STYLE.stroke}
                    strokeDasharray={ECOLI_GMV_LIMIT_STYLE.strokeDasharray}
                    strokeWidth={ECOLI_GMV_LIMIT_STYLE.strokeWidth}
                    name={ECOLI_GMV_LIMIT_NAME}
                  />
                )}
                {chartData.hasFecalData && FECAL_GMV_LIMIT_VALUE <= chartData.leftAxisMax && (
                  <ReferenceLine
                    y={FECAL_GMV_LIMIT_VALUE}
                    yAxisId="left"
                    stroke={FECAL_GMV_LIMIT_STYLE.stroke}
                    strokeDasharray={FECAL_GMV_LIMIT_STYLE.strokeDasharray}
                    strokeWidth={FECAL_GMV_LIMIT_STYLE.strokeWidth}
                    name={FECAL_GMV_LIMIT_NAME}
                  />
                )}
                <Scatter
                  yAxisId="left"
                  data={chartData.ecoliObservationSeries}
                  dataKey="EcoliValue"
                  fill={KPH_D_ECOLI_OBSERVATION_COLOR}
                  shape={KphdObservationShape}
                  name={ECOLI_OBSERVATIONS_SERIES_NAME}
                />
                {chartData.ecoliThresholdExceedances.length > 0 && (
                  <Scatter
                    yAxisId="left"
                    data={chartData.ecoliThresholdExceedances}
                    dataKey="Value"
                    fill="transparent"
                    stroke={ECOLI_P90_LIMIT_COLOR}
                    strokeWidth={2}
                    isAnimationActive={false}
                    shape={ECOLI_THRESHOLD_SHAPE}
                    name={ECOLI_THRESHOLD_SERIES_NAME}
                  />
                )}
                {chartData.hasFecalData && (
                  <Scatter
                    yAxisId="left"
                    data={chartData.fecalObservationSeries}
                    dataKey="FecalValue"
                    fill="#d62728"
                    name={FECAL_OBSERVATIONS_SERIES_NAME}
                  />
                )}
                {/* E. coli above threshold hidden for QA */}
                {false && <Scatter
                  yAxisId="left"
                  data={chartData.ecoliStats.filter((row) => row.Crosses_Above_Threshold)}
                  dataKey="Value"
                  fill="none"
                  stroke="#2ca02c"
                  shape={(props) => {
                    const { cx, cy } = props
                    return <rect x={cx - 6} y={cy - 6} width={12} height={12} stroke="#2ca02c" fill="none" strokeWidth={2} />
                  }}
                  name="E. coli above threshold"
                />}
                {/* E. coli below threshold hidden for QA */}
                {false && <Scatter
                  yAxisId="left"
                  data={chartData.ecoliStats.filter((row) => row.Crosses_Below_Threshold)}
                  dataKey="Value"
                  fill="none"
                  stroke="#2ca02c"
                  shape={(props) => {
                    const { cx, cy } = props
                    return <path d={`M${cx - 6},${cy + 6} L${cx},${cy - 6} L${cx + 6},${cy + 6} Z`} stroke="#2ca02c" fill="none" strokeWidth={2} />
                  }}
                  name="E. coli below threshold"
                />}
                {chartData.hasFecalData && chartData.fecalThresholdExceedances.length > 0 && (
                  <Scatter
                    yAxisId="left"
                    data={chartData.fecalThresholdExceedances}
                    dataKey="Value"
                    fill="transparent"
                    stroke={FECAL_P90_LIMIT_COLOR}
                    strokeWidth={2}
                    isAnimationActive={false}
                    shape={FECAL_THRESHOLD_SHAPE}
                    name={FECAL_THRESHOLD_SERIES_NAME}
                  />
                )}
                {/* Fecal Coliform below threshold hidden for QA */}
                {false && <Scatter
                  yAxisId="left"
                  data={chartData.fecalStats.filter((row) => row.Crosses_Below_Threshold)}
                  dataKey="Value"
                  fill="none"
                  stroke="#d62728"
                  shape={(props) => {
                    const { cx, cy } = props
                    return <path d={`M${cx - 6},${cy + 6} L${cx},${cy - 6} L${cx + 6},${cy + 6} Z`} stroke="#d62728" fill="none" strokeWidth={2} />
                  }}
                  name="Fecal Coliform below threshold"
                />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {!chartData.hasFecalData && (
            <div className="warning-banner">No WA DOH fecal coliform station exists for this catchment; only E. coli will display for the selected station.</div>
          )}
          {chartData.showKphdFecalNote && (
            <div className="info-banner">Light green observations in the &quot;E. coli observations&quot; series before 2020 are actually Fecal Coliform observations.</div>
          )}
          <section className="data-table-section">
            <h3>Table of KPHD Observations from gage {selectedStationDetails?.EIMLocationID}</h3>
            <p className="table-threshold-note">
              EPA E. coli thresholds in fresh water: GMV threshold: {ECOLI_GMV_LIMIT_VALUE} cfu/100mL; 90%ile threshold: {ECOLI_P90_LIMIT_VALUE} cfu/100mL
            </p>
            <div className="table-scroll">
              <table className="observations-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Constituent</th>
                    <th>Avg_Obs</th>
                    <th>Count</th>
                    <th>units</th>
                    <th>30GMV</th>
                    <th>90%ile_raw</th>
                    <th>90%ile_ln</th>
                    <th>90%ile_chart</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.kphdTableRows.map((row, index) => (
                    <tr key={`${row.Date.toISOString()}-${row.Value}-${index}`}>
                      <td>{formatDate(row.Date)}</td>
                      <td>{row.Constituent}</td>
                      <td>{formatNumber(row.Value, 1)}</td>
                      <td>{row.Count}</td>
                      <td>{row.Units}</td>
                      <td className={row.GMV30 > ECOLI_GMV_LIMIT_VALUE ? 'threshold-exceedance' : undefined}>{formatNumber(row.GMV30)}</td>
                      <td className={row.P90_30 > ECOLI_P90_LIMIT_VALUE ? 'threshold-exceedance' : undefined}>{formatNumber(row.P90_30)}</td>
                      <td className={row.P90_LN_30 > ECOLI_P90_LIMIT_VALUE ? 'threshold-exceedance' : undefined}>{formatNumber(row.P90_LN_30)}</td>
                      <td>{row.Exceeds_RegThreshold ? formatNumber(row.Value, 1) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {chartData.hasFecalData && (
            <section className="data-table-section">
              <h3>Table of WA DOH observations for gage ID: {selectedStationDetails?.WADOHStation}</h3>
              <p className="table-threshold-note">
                Fecal Coliform thresholds: GMV threshold: {FECAL_GMV_LIMIT_VALUE} cfu/100mL; 90%ile threshold: {FECAL_P90_LIMIT_VALUE} colonies/100mL
              </p>
              <div className="table-scroll">
                <table className="observations-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Constituent</th>
                      <th>Avg_Obs</th>
                      <th>Count</th>
                      <th>units</th>
                      <th>30GMV</th>
                      <th>90%ile_raw</th>
                      <th>90%ile_ln</th>
                      <th>90%ile_chart</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.waDohTableRows.map((row, index) => (
                      <tr key={`${row.Date.toISOString()}-${row.Value}-${index}`}>
                        <td>{formatDate(row.Date)}</td>
                        <td>{row.Constituent}</td>
                        <td>{formatNumber(row.Value, 1)}</td>
                        <td>{row.Count}</td>
                        <td>{row.Units}</td>
                        <td className={row.GMV30 > FECAL_GMV_LIMIT_VALUE ? 'threshold-exceedance' : undefined}>{formatNumber(row.GMV30)}</td>
                        <td className={row.P90_30 > FECAL_P90_LIMIT_VALUE ? 'threshold-exceedance' : undefined}>{formatNumber(row.P90_30)}</td>
                        <td className={row.P90_LN_30 > FECAL_P90_LIMIT_VALUE ? 'threshold-exceedance' : undefined}>{formatNumber(row.P90_LN_30)}</td>
                        <td>{row.Exceeds_RegThreshold ? formatNumber(row.Value, 1) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>
      ) : (
        <div className="empty-state">
          <p>Choose a station and year range, then click Generate chart.</p>
        </div>
      )}
    </div>
  )
}

export default App
