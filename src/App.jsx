import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { ComposedChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Bar, Line, Scatter, ReferenceLine } from 'recharts'

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

const collapseDaily = (rows) => {
  const group = new Map()
  rows.forEach((row) => {
    const day = row.Date.toISOString().slice(0, 10)
    const existing = group.get(day)
    if (!existing) {
      group.set(day, { Date: row.Date, sum: row.Value, count: 1 })
    } else {
      existing.sum += row.Value
      existing.count += 1
    }
  })
  return Array.from(group.values())
    .map((item) => ({ Date: item.Date, Value: item.sum / item.count }))
    .sort((a, b) => a.Date - b.Date)
}

const addRollingStats = (rows, threshold, window = 30) => {
  const out = rows.map((row) => ({ ...row, GMV30: NaN, P90_30: NaN, Exceeds_RegThreshold: false, Crosses_Above_Threshold: false, Crosses_Below_Threshold: false }))
  for (let index = 0; index < out.length; index += 1) {
    const windowRows = out.slice(Math.max(0, index - window + 1), index + 1)
    if (windowRows.length === window) {
      const values = windowRows.map((row) => row.Value)
      const gmv = geometricMean(values)
      const p90 = quantile(values, 0.9)
      out[index].GMV30 = Number.isNaN(gmv) ? null : gmv
      out[index].P90_30 = Number.isNaN(p90) ? null : p90
      out[index].Exceeds_RegThreshold = p90 > threshold
    }
    if (index > 0 && out[index].P90_30 != null && out[index - 1].P90_30 != null) {
      out[index].Crosses_Above_Threshold = out[index].Exceeds_RegThreshold && !out[index - 1].Exceeds_RegThreshold
      out[index].Crosses_Below_Threshold = !out[index].Exceeds_RegThreshold && out[index - 1].Exceeds_RegThreshold
    }
  }
  return out
}

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
              Date: parseDate(row.Date),
              Value: Number(row.Value),
            }))
            .filter((row) => row.Catchment && row.Date && !Number.isNaN(row.Value)),
        )

        setFecal(
          fecalCsv
            .map((row) => ({
              Catchment: row.Catchment,
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

  const legendPayload = useMemo(() => [
    { value: 'Precipitation', type: 'square', color: '#1f77b4' },
    { value: 'E. coli GMV30', type: 'line', color: '#2ca02c' },
    { value: 'Fecal Coliform GMV30', type: 'line', color: '#d62728' },
    { value: 'E. coli observations', type: 'square', color: '#2ca02c' },
    { value: 'Fecal Coliform observations (points)', type: 'circle', color: '#d62728' },
    { value: 'Fecal Coliform 90% > threshold', type: 'square', color: '#d62728' },
  ], [])

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

    const ecoliStats = addRollingStats(ecoliForStats, 100)
    const fecalStats = addRollingStats(fecalForStats, 100)

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
    const chartSeries = createChartSeries(filteredPrecip, ecoliStats, fecalStats, rangeStart, rangeEnd)

    setChartData({
      chartSeries,
      ecoliStats: sampleEcoliStats,
      fecalStats: sampleFecalStats,
      hasFecalData: Boolean(stationFecal.length),
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
          <h2>Chart for {selectedStationDetails?.DisplayName}</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={540}>
              <ComposedChart data={chartData.chartSeries}>
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
                  domain={[1, 'dataMax']}
                  allowDataOverflow={true}
                  tickFormatter={(value) => (value >= 1 ? value.toString() : '')}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={['dataMax', 0]}
                  tickFormatter={(value) => value.toFixed(2)}
                />
                <Tooltip
                  labelFormatter={(value) => formatDate(value)}
                  formatter={(value, name) => [value, name]}
                />
                <Legend payload={legendPayload} />

                {/* E. coli threshold reference line removed per request */}

                <Bar dataKey="Precip_in" barSize={2} barCategoryGap="2%" fill="#1f77b4" opacity={0.25} yAxisId="right" />
                <Line
                  yAxisId="left"
                  type="monotone"
                  data={chartData.ecoliStats.filter((row) => row.GMV30 != null)}
                  dataKey="GMV30"
                  stroke="#2ca02c"
                  strokeWidth={3}
                  name="E. coli GMV30"
                  dot={false}
                  connectNulls={true}
                />
                {/* Fecal Coliform GMV30 is hidden for QA */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  data={chartData.fecalStats.filter((row) => row.GMV30 != null)}
                  dataKey="GMV30"
                  stroke="#d62728"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  name="Fecal Coliform GMV30"
                  dot={false}
                  connectNulls={true}
                />
                <Scatter
                  yAxisId="left"
                  data={chartData.ecoliStats.filter((row) => row.Value != null)}
                  dataKey="Value"
                  fill="#2ca02c"
                  name="E. coli observations"
                />
                <Scatter
                  yAxisId="left"
                  data={chartData.fecalStats.filter((row) => row.Value != null)}
                  dataKey="Value"
                  fill="#d62728"
                  name="Fecal Coliform observations (points)"
                />
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
                <Scatter
                  yAxisId="left"
                  data={chartData.fecalStats.filter((row) => row.Exceeds_RegThreshold)}
                  dataKey="Value"
                  fill="transparent"
                  stroke="#d62728"
                  strokeWidth={2}
                  isAnimationActive={false}
                  shape={(props) => {
                    const { cx, cy } = props
                    return <rect x={cx - 6} y={cy - 6} width={12} height={12} stroke="#d62728" fill="none" strokeWidth={2} />
                  }}
                  name="Fecal Coliform 90% > threshold"
                />
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
