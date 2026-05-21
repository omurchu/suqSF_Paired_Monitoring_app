# Monitoring React App

A lightweight React app to browse monitoring station pairs and generate the original chart form from `FC_Monitoring_Comps_v3.py`.

## Setup

1. Open a terminal in `Monitoring_React_App`
2. Run `npm install`
3. Run `npm run dev`

## Data

The app loads these CSV files from `public/data`:
- `station_lookup.csv`
- `precip_filtered.csv`
- `kphd_ecoli_filtered.csv`
- `wa_doh_fc_filtered.csv`

## Usage

- Select a station pair from the dropdown.
- Choose a beginning and end year.
- Click **Generate chart**.

The chart shows:
- daily precipitation bars
- E. coli and fecal coliform observations
- 30-observation geometric mean lines
- threshold markers for exceedance transitions
