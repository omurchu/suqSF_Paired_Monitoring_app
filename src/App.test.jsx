import React from 'react'
import {
  LEGEND_PAYLOAD,
  ECOLI_THRESHOLD_SHAPE,
  ECOLI_THRESHOLD_SERIES_NAME,
  ECOLI_P90_LIMIT_COLOR,
  FECAL_THRESHOLD_SHAPE,
  FECAL_THRESHOLD_SERIES_NAME,
  FECAL_P90_LIMIT_COLOR,
  FECAL_GMV30_SERIES_NAME,
  ECOLI_GMV30_SERIES_NAME,
  ECOLI_OBSERVATIONS_SERIES_NAME,
  FECAL_OBSERVATIONS_SERIES_NAME,
  FECAL_GMV30_STYLE,
  ECOLI_GMV_LIMIT_VALUE,
  ECOLI_GMV_LIMIT_NAME,
  ECOLI_GMV_LIMIT_STYLE,
  ECOLI_P90_LIMIT_VALUE,
  FECAL_P90_LIMIT_VALUE,
  FECAL_GMV_LIMIT_NAME,
  FECAL_GMV_LIMIT_VALUE,
  FECAL_GMV_LIMIT_STYLE,
} from './chartSeries'

describe('App series symbology', () => {
  it('defines a Fecal Coliform threshold legend entry as a purple square', () => {
    const entry = LEGEND_PAYLOAD.find((item) => item.value === FECAL_THRESHOLD_SERIES_NAME)
    expect(entry).toEqual({
      value: FECAL_THRESHOLD_SERIES_NAME,
      type: 'square',
      color: FECAL_P90_LIMIT_COLOR,
    })
  })

  it('defines an E. coli threshold legend entry as a brown diamond', () => {
    const entry = LEGEND_PAYLOAD.find((item) => item.value === ECOLI_THRESHOLD_SERIES_NAME)
    expect(entry).toEqual({
      value: ECOLI_THRESHOLD_SERIES_NAME,
      type: 'diamond',
      color: ECOLI_P90_LIMIT_COLOR,
    })
  })

  it('renders the E. coli threshold shape as an unfilled brown diamond', () => {
    const element = ECOLI_THRESHOLD_SHAPE({ cx: 40, cy: 60 })
    expect(element.type).toBe('path')
    expect(element.props.d).toBe('M40,50 L50,60 L40,70 L30,60 Z')
    expect(element.props.stroke).toBe(ECOLI_P90_LIMIT_COLOR)
    expect(element.props.fill).toBe('none')
    expect(element.props.strokeWidth).toBe(2.5)
  })

  it('renders the fecal threshold shape as an unfilled purple square', () => {
    const element = FECAL_THRESHOLD_SHAPE({ cx: 40, cy: 60 })

    // exact element shape and props: an unfilled red square
    expect(element.type).toBe('rect')
    expect(element.props.x).toBe(34)
    expect(element.props.y).toBe(54)
    expect(element.props.width).toBe(12)
    expect(element.props.height).toBe(12)
    expect(element.props.stroke).toBe(FECAL_P90_LIMIT_COLOR)
    expect(element.props.fill).toBe('none')
    expect(element.props.strokeWidth).toBe(2)
  })

  it('keeps Fecal Coliform GMV30 distinct from fecal threshold series names', () => {
    expect(FECAL_GMV30_SERIES_NAME).toBe('Fecal Coliform GMV30')
    expect(FECAL_THRESHOLD_SERIES_NAME).toBe('Fecal Coliform 90% > 43 colonies/100mL')
  })

  it('tracks both E. coli and fecal observation series separately', () => {
    expect(ECOLI_OBSERVATIONS_SERIES_NAME).toBe('E. coli observations')
    expect(FECAL_OBSERVATIONS_SERIES_NAME).toBe('Fecal Coliform observations')
  })

  it('uses a green circle legend icon for E. coli observations', () => {
    expect(LEGEND_PAYLOAD.find((item) => item.value === ECOLI_OBSERVATIONS_SERIES_NAME)).toMatchObject({
      type: 'circle',
      color: '#2ca02c',
    })
  })

  it('renders pre-2020 KPHD fecal observations as light green points in the E. coli series', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    expect(src).toContain("const KPH_D_FECAL_OBSERVATION_COLOR = '#98df8a'")
    expect(src).toContain("payload?.Constituent === 'Fecal Coliform' ? KPH_D_FECAL_OBSERVATION_COLOR : KPH_D_ECOLI_OBSERVATION_COLOR")
    expect(src).toContain('shape={KphdObservationShape}')
    expect(src).toContain('showKphdFecalNote: startYear < 2020')
    expect(src).toContain('Light green observations in the &quot;E. coli observations&quot; series before 2020 are actually Fecal Coliform observations.')
  })

  it('groups E. coli legend items before fecal coliform legend items', () => {
    const legendNames = LEGEND_PAYLOAD.map((item) => item.value)
    expect(legendNames).toEqual([
      'Precipitation',
      ECOLI_GMV30_SERIES_NAME,
      ECOLI_GMV_LIMIT_NAME,
      ECOLI_OBSERVATIONS_SERIES_NAME,
      ECOLI_THRESHOLD_SERIES_NAME,
      FECAL_GMV30_SERIES_NAME,
      FECAL_GMV_LIMIT_NAME,
      FECAL_OBSERVATIONS_SERIES_NAME,
      FECAL_THRESHOLD_SERIES_NAME,
    ])
  })

  it('uses plain line legend icons for GMV and limit lines', () => {
    const lineEntries = [
      ECOLI_GMV30_SERIES_NAME,
      ECOLI_GMV_LIMIT_NAME,
      FECAL_GMV30_SERIES_NAME,
      FECAL_GMV_LIMIT_NAME,
    ]
    lineEntries.forEach((name) => {
      expect(LEGEND_PAYLOAD.find((item) => item.value === name)).toMatchObject({
        type: 'plainline',
        payload: expect.objectContaining({ strokeDasharray: expect.any(String) }),
      })
    })
  })

  it('renders Fecal Coliform GMV30 style as a solid red line', () => {
    expect(FECAL_GMV30_STYLE).toMatchObject({ stroke: '#d62728' })
    expect(FECAL_GMV30_STYLE.strokeDasharray || '').toBe('')
  })

  it('exposes a Fecal Coliform GMV limit dashed red line at 14 cfu/100mL', () => {
    const legendEntry = LEGEND_PAYLOAD.find((e) => e.value === FECAL_GMV_LIMIT_NAME)
    expect(legendEntry).toMatchObject({ color: '#d62728', dash: '4 4' })
    expect(FECAL_GMV_LIMIT_NAME).toBe('Fecal Coliform GMV limit (14 cfu/100mL)')
    expect(FECAL_GMV_LIMIT_VALUE).toBe(14)
    expect(FECAL_GMV_LIMIT_STYLE).toMatchObject({ stroke: '#d62728', strokeDasharray: '4 4' })
  })

  it('renders the Fecal Coliform GMV limit as a chart ReferenceLine', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    expect(src).toMatch(/<ReferenceLine[\s\S]*y=\{FECAL_GMV_LIMIT_VALUE\}/)
    expect(src).toMatch(/stroke=\{FECAL_GMV_LIMIT_STYLE\.stroke\}/)
    expect(src).toMatch(/strokeDasharray=\{FECAL_GMV_LIMIT_STYLE\.strokeDasharray\}/)
  })

  it('does not render the 90% threshold as a ReferenceLine in the chart source', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    const escaped = FECAL_THRESHOLD_SERIES_NAME.replace(/[-\\/\\^$*+?.()|[\]{}]/g, '\\$&')
    const badPattern = new RegExp(`ReferenceLine[\s\S]*${escaped}`)
    expect(badPattern.test(src)).toBe(false)
  })

  it('uses the fecal 90th percentile threshold for exceedance checks', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    const fecalThresholdMatch = src.match(/addRollingStats\s*\(\s*fecalForStats\s*,\s*(\w+)\s*,\s*30,\s*percentileExceedanceMethod\s*\)/)
    expect(fecalThresholdMatch).toBeDefined()
    expect(fecalThresholdMatch[1]).toBe('FECAL_P90_LIMIT_VALUE')
    expect(FECAL_P90_LIMIT_VALUE).toBe(43)
    expect(FECAL_GMV_LIMIT_VALUE).toBe(14)
  })

  it('uses the E. coli 90th percentile threshold for exceedance checks', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    const ecoliThresholdMatch = src.match(/addRollingStats\s*\(\s*ecoliForStats\s*,\s*(\w+)\s*,\s*30,\s*percentileExceedanceMethod\s*\)/)
    expect(ecoliThresholdMatch).toBeDefined()
    expect(ecoliThresholdMatch[1]).toBe('ECOLI_P90_LIMIT_VALUE')
    expect(ECOLI_P90_LIMIT_VALUE).toBe(320)
    expect(ECOLI_GMV_LIMIT_VALUE).toBe(100)
  })

  it('renders the E. coli GMV limit as a dashed green ReferenceLine', () => {
    const legendEntry = LEGEND_PAYLOAD.find((e) => e.value === ECOLI_GMV_LIMIT_NAME)
    expect(legendEntry).toMatchObject({ color: '#2ca02c', dash: '4 4' })
    expect(ECOLI_GMV_LIMIT_NAME).toBe('E. coli GMV limit (100 cfu/100mL)')
    expect(ECOLI_GMV_LIMIT_STYLE).toMatchObject({ stroke: '#2ca02c', strokeDasharray: '4 4' })

    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    expect(src).toMatch(/<ReferenceLine[\s\S]*y=\{ECOLI_GMV_LIMIT_VALUE\}/)
    expect(src).toMatch(/stroke=\{ECOLI_GMV_LIMIT_STYLE\.stroke\}/)
    expect(src).toMatch(/strokeDasharray=\{ECOLI_GMV_LIMIT_STYLE\.strokeDasharray\}/)
  })

  it('sets the left axis maximum from observations with five percent headroom', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    expect(src).toMatch(/const observedValues = \[\.\.\.sampleEcoliStats, \.\.\.sampleFecalStats\]/)
    expect(src).toMatch(/leftAxisMax: Math\.max\(1, maxObservedValue \* 1\.05\)/)
    expect(src).toMatch(/domain=\{\[1, chartData\.leftAxisMax\]\}/)
  })

  it('labels the bacterial and precipitation axes with units', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    expect(src).toContain('E. coli (cfu/100mL) / Fecal Coliform (colonies/100mL)')
    expect(src).toContain('Precipitation (inches)')
  })

  it('renders a KPHD observations table with rolling statistic columns', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    expect(src).toContain('Table of KPHD Observations from gage')
    expect(src).toContain('selectedStationDetails?.EIMLocationID')
    expect(src).toContain('<th>Date</th>')
    expect(src).toContain('<th>Constituent</th>')
    expect(src).toContain('<th>Avg_Obs</th>')
    expect(src).toContain('<th>Count</th>')
    expect(src).toContain('<th>units</th>')
    expect(src).toContain('<th>30GMV</th>')
    expect(src).toContain('<th>90%ile_raw</th>')
    expect(src).toContain('<th>90%ile_ln</th>')
    expect(src).toContain('<th>90%ile_chart</th>')
    expect(src).toContain('EPA E. coli thresholds in fresh water:')
    expect(src).toContain('GMV threshold:')
    expect(src).toContain('90%ile threshold:')
    expect(src).toMatch(/sort\(\(a, b\) => b\.Date - a\.Date\)/)
    expect(src).toContain('row.GMV30')
    expect(src).toContain('row.P90_30')
    expect(src).toContain('row.P90_LN_30')
    expect(src).toContain('<td>{row.Count}</td>')
    expect(src).toContain('? collapsedEcoli')
    expect(src).toContain(': collapsedEcoli')
    expect(src).toContain('? collapsedFecal')
    expect(src).toContain(': collapsedFecal')
    expect(src).toContain('.map((row) => ({ ...row, date: row.Date.getTime() }))')
    expect(src).toContain("row.GMV30 > ECOLI_GMV_LIMIT_VALUE ? 'threshold-exceedance' : undefined")
    expect(src).toContain("row.P90_30 > ECOLI_P90_LIMIT_VALUE ? 'threshold-exceedance' : undefined")
    expect(src).toContain("row.P90_LN_30 > ECOLI_P90_LIMIT_VALUE ? 'threshold-exceedance' : undefined")
    expect(src).toContain("row.Exceeds_RegThreshold ? formatNumber(row.Value, 1) : ''")
  })

  it('calculates a lognormal 90th percentile over the rolling window', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    expect(src).toContain('const lognormalPercentile = (values, zScore) => {')
    expect(src).toContain('const logValues = values.map((value) => Math.log(value))')
    expect(src).toContain('Math.exp(logMean + (zScore * logSd))')
    expect(src).toContain('const p90Ln = lognormalPercentile(values, 1.2815515655446004)')
    expect(src).toContain("const exceedanceValue = exceedanceMethod === 'raw' ? p90 : p90Ln")
    expect(src).toContain('P90_LN_30')
  })

  it('collapses table rows to one averaged observation per day with a count', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    expect(src).toContain('const collapseDaily = (rows) => {')
    expect(src).toContain('...row,')
    expect(src).toContain('Value: item.sum / item.count')
    expect(src).toContain('Count: item.count')
  })

  it('defaults 90 percent exceedance checks to the lognormal method with a raw option', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    expect(src).toContain("useState('lognormal')")
    expect(src).toContain('For 90% exceedance checks, use')
    expect(src).toContain('role="radiogroup"')
    expect(src).toContain('type="radio"')
    expect(src).toContain('Estimated 90%ile based on a lognormal distribution')
    expect(src).toContain('Raw rolling 90%ile from observation values')
    expect(src).toContain('percentileExceedanceMethod')
  })

  it('renders GMV trend lines as straight segments', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    expect(src).toMatch(/<Line[\s\S]*type="linear"[\s\S]*name=\{ECOLI_GMV30_SERIES_NAME\}/)
    expect(src).toMatch(/<Line[\s\S]*type="linear"[\s\S]*name=\{FECAL_GMV30_SERIES_NAME\}/)
    expect(src).not.toContain('type="monotone"')
  })

  it('uses unique chart data keys and two-decimal tooltip formatting', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    expect(src).toContain("const formatTooltipValue = (value) => (typeof value === 'number' ? value.toFixed(2) : value)")
    expect(src).toContain('formatter={(value, name) => [formatTooltipValue(value), name]}')
    expect(src).toContain('dataKey="EcoliGMV"')
    expect(src).toContain('dataKey="FecalGMV"')
    expect(src).toContain('dataKey="EcoliValue"')
    expect(src).toContain('dataKey="FecalValue"')
    expect(src).toContain('ecoliGmvSeries:')
    expect(src).toContain('fecalGmvSeries:')
    expect(src).toContain('ecoliObservationSeries:')
    expect(src).toContain('fecalObservationSeries:')
    expect(src).toContain('data={chartData.ecoliGmvSeries}')
    expect(src).toContain('data={chartData.fecalGmvSeries}')
    expect(src).toContain('data={chartData.ecoliObservationSeries}')
    expect(src).toContain('data={chartData.fecalObservationSeries}')
  })

  it('renders a WA DOH observations table with fecal rolling statistic thresholds', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    expect(src).toContain('Table of WA DOH observations for gage ID:')
    expect(src).toContain('selectedStationDetails?.WADOHStation')
    expect(src).toContain('waDohTableRows')
    expect(src).toContain('Fecal Coliform thresholds:')
    expect(src).toContain('<th>90%ile_chart</th>')
    expect(src).toContain("row.Exceeds_RegThreshold ? formatNumber(row.Value, 1) : ''")
    expect(src).toContain("row.GMV30 > FECAL_GMV_LIMIT_VALUE ? 'threshold-exceedance' : undefined")
    expect(src).toContain("row.P90_30 > FECAL_P90_LIMIT_VALUE ? 'threshold-exceedance' : undefined")
    expect(src).toContain("row.P90_LN_30 > FECAL_P90_LIMIT_VALUE ? 'threshold-exceedance' : undefined")
  })

  it('hides fecal chart and legend items when no paired fecal gage exists', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    expect(src).toContain('LEGEND_PAYLOAD.filter')
    expect(src).toContain('![')
    expect(src).toContain('FECAL_GMV_LIMIT_NAME')
    expect(src).toContain('FECAL_OBSERVATIONS_SERIES_NAME')
    expect(src).toContain('{chartData.hasFecalData && FECAL_GMV_LIMIT_VALUE <= chartData.leftAxisMax && (')
    expect(src).toContain('{chartData.hasFecalData && (')
  })

  it('renders the fecal 90th percentile marker series only when exceedance rows exist', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    expect(src).toContain('const fecalThresholdExceedances = waDohTableRows.filter((row) => row.Exceeds_RegThreshold)')
    expect(src).toContain('fecalThresholdExceedances,')
    expect(src).toContain('item.value !== FECAL_THRESHOLD_SERIES_NAME || chartData.fecalThresholdExceedances.length > 0')
    expect(src).toContain('{chartData.hasFecalData && chartData.fecalThresholdExceedances.length > 0 && (')
    expect(src).toContain('data={chartData.fecalThresholdExceedances}')
  })

  it('renders the E. coli 90th percentile marker series only when exceedance rows exist', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    expect(src).toContain('const ecoliThresholdExceedances = kphdTableRows.filter((row) => row.Exceeds_RegThreshold)')
    expect(src).toContain('ecoliThresholdExceedances,')
    expect(src).toContain('item.value !== ECOLI_THRESHOLD_SERIES_NAME || chartData.ecoliThresholdExceedances.length > 0')
    expect(src).toContain('{chartData.ecoliThresholdExceedances.length > 0 && (')
    expect(src).toContain('data={chartData.ecoliThresholdExceedances}')
    expect(src).toContain('shape={ECOLI_THRESHOLD_SHAPE}')
    expect(src).toContain('stroke={ECOLI_P90_LIMIT_COLOR}')
  })

  it('only draws GMV reference lines when they fit inside the left axis range', () => {
    const fs = require('fs')
    const path = require('path')
    const srcPath = path.resolve(__dirname, 'App.jsx')
    const src = fs.readFileSync(srcPath, 'utf8')
    expect(src).toContain('{ECOLI_GMV_LIMIT_VALUE <= chartData.leftAxisMax && (')
    expect(src).toContain('{chartData.hasFecalData && FECAL_GMV_LIMIT_VALUE <= chartData.leftAxisMax && (')
  })
})
