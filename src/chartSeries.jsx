export const ECOLI_GMV30_SERIES_NAME = 'E. coli GMV30'
export const FECAL_GMV30_SERIES_NAME = 'Fecal Coliform GMV30'
export const ECOLI_OBSERVATIONS_SERIES_NAME = 'E. coli observations'
export const FECAL_OBSERVATIONS_SERIES_NAME = 'Fecal Coliform observations'
export const ECOLI_GMV_LIMIT_VALUE = 100
export const ECOLI_GMV_LIMIT_NAME = `E. coli GMV limit (${ECOLI_GMV_LIMIT_VALUE} cfu/100mL)`
export const ECOLI_P90_LIMIT_VALUE = 320
export const FECAL_P90_LIMIT_VALUE = 43
export const FECAL_THRESHOLD_SERIES_NAME = `Fecal Coliform 90% > ${FECAL_P90_LIMIT_VALUE} colonies/100mL`
export const FECAL_GMV_LIMIT_VALUE = 14
export const FECAL_GMV_LIMIT_NAME = `Fecal Coliform GMV limit (${FECAL_GMV_LIMIT_VALUE} cfu/100mL)`

export const LEGEND_PAYLOAD = [
  { value: 'Precipitation', type: 'square', color: '#1f77b4' },
  { value: ECOLI_GMV30_SERIES_NAME, type: 'plainline', color: '#2ca02c', payload: { strokeDasharray: '' } },
  { value: ECOLI_GMV_LIMIT_NAME, type: 'plainline', color: '#2ca02c', dash: '4 4', payload: { strokeDasharray: '4 4' } },
  { value: ECOLI_OBSERVATIONS_SERIES_NAME, type: 'square', color: '#2ca02c' },
  { value: FECAL_GMV30_SERIES_NAME, type: 'plainline', color: '#d62728', payload: { strokeDasharray: '' } },
  { value: FECAL_GMV_LIMIT_NAME, type: 'plainline', color: '#d62728', dash: '4 4', payload: { strokeDasharray: '4 4' } },
  { value: FECAL_OBSERVATIONS_SERIES_NAME, type: 'circle', color: '#d62728' },
  { value: FECAL_THRESHOLD_SERIES_NAME, type: 'square', color: '#d62728' },
]

export const FECAL_THRESHOLD_SHAPE = ({ cx, cy }) => (
  <rect x={cx - 6} y={cy - 6} width={12} height={12} stroke="#d62728" fill="none" strokeWidth={2} />
)

export const FECAL_GMV30_STYLE = {
  stroke: '#d62728',
  strokeDasharray: '',
  strokeWidth: 2,
}

export const ECOLI_GMV_LIMIT_STYLE = {
  stroke: '#2ca02c',
  strokeDasharray: '4 4',
  strokeWidth: 1,
}

export const FECAL_GMV_LIMIT_STYLE = {
  stroke: '#d62728',
  strokeDasharray: '4 4',
  strokeWidth: 1,
}
