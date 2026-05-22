import React from 'react'
import {
  LEGEND_PAYLOAD,
  FECAL_THRESHOLD_SHAPE,
  FECAL_THRESHOLD_SERIES_NAME,
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
  it('defines a Fecal Coliform threshold legend entry as a red square', () => {
    const entry = LEGEND_PAYLOAD.find((item) => item.value === FECAL_THRESHOLD_SERIES_NAME)
    expect(entry).toEqual({
      value: FECAL_THRESHOLD_SERIES_NAME,
      type: 'square',
      color: '#d62728',
    })
  })

  it('renders the fecal threshold shape as an unfilled red square', () => {
    const element = FECAL_THRESHOLD_SHAPE({ cx: 40, cy: 60 })

    // exact element shape and props: an unfilled red square
    expect(element.type).toBe('rect')
    expect(element.props.x).toBe(34)
    expect(element.props.y).toBe(54)
    expect(element.props.width).toBe(12)
    expect(element.props.height).toBe(12)
    expect(element.props.stroke).toBe('#d62728')
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

  it('groups E. coli legend items before fecal coliform legend items', () => {
    const legendNames = LEGEND_PAYLOAD.map((item) => item.value)
    expect(legendNames).toEqual([
      'Precipitation',
      ECOLI_GMV30_SERIES_NAME,
      ECOLI_GMV_LIMIT_NAME,
      ECOLI_OBSERVATIONS_SERIES_NAME,
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
    const fecalThresholdMatch = src.match(/addRollingStats\s*\(\s*fecalForStats\s*,\s*(\w+)\s*\)/)
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
    const ecoliThresholdMatch = src.match(/addRollingStats\s*\(\s*ecoliForStats\s*,\s*(\w+)\s*\)/)
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
})
