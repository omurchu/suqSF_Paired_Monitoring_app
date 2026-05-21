import csv
import datetime
import math
from pathlib import Path

root = Path('public/data')

precip = []
with open(root / 'precip_filtered.csv', newline='') as f:
    for r in csv.DictReader(f):
        precip.append({'Date': datetime.datetime.fromisoformat(r['Date']), 'Precip_in': float(r['Precip_in'])})

ecoli = []
with open(root / 'kphd_ecoli_filtered.csv', newline='') as f:
    for r in csv.DictReader(f):
        ecoli.append({'Catchment': r['Catchment'], 'Date': datetime.datetime.fromisoformat(r['Date']), 'Value': float(r['Value'])})

fecal = []
with open(root / 'wa_doh_fc_filtered.csv', newline='') as f:
    for r in csv.DictReader(f):
        fecal.append({'Catchment': r['Catchment'], 'Date': datetime.datetime.fromisoformat(r['Date']), 'Value': float(r['Value'])})

start = datetime.datetime(2021, 1, 1)
end = datetime.datetime(2025, 12, 31)
selectedStation = 'Chico Creek'

# collapseDaily

def collapse(rows):
    grouped = {}
    for row in rows:
        key = row['Date'].date().isoformat()
        if key not in grouped:
            grouped[key] = {'Date': row['Date'], 'sum': row['Value'], 'count': 1}
        else:
            grouped[key]['sum'] += row['Value']
            grouped[key]['count'] += 1
    return sorted([
        {'Date': v['Date'], 'Value': v['sum'] / v['count']} for v in grouped.values()
    ], key=lambda x: x['Date'])


def quantile(values, q):
    sorted_vals = sorted(values)
    pos = (len(sorted_vals) - 1) * q
    lower = int(math.floor(pos))
    upper = int(math.ceil(pos))
    if upper == lower:
        return sorted_vals[lower]
    w = pos - lower
    return sorted_vals[lower] * (1 - w) + sorted_vals[upper] * w


def geometric_mean(values):
    if not values or any(v <= 0 for v in values):
        return float('nan')
    return math.exp(sum(math.log(v) for v in values) / len(values))


def add_rolling_stats(rows, threshold, window=30):
    out = [
        {
            **row,
            'GMV30': None,
            'P90_30': None,
            'Exceeds_RegThreshold': False,
            'Crosses_Above_Threshold': False,
            'Crosses_Below_Threshold': False,
        }
        for row in rows
    ]

    for i in range(len(out)):
        window_rows = out[max(0, i - window + 1) : i + 1]
        if len(window_rows) == window:
            values = [r['Value'] for r in window_rows]
            gmv = geometric_mean(values)
            p90 = quantile(values, 0.9)
            out[i]['GMV30'] = None if math.isnan(gmv) else gmv
            out[i]['P90_30'] = None if math.isnan(p90) else p90
            out[i]['Exceeds_RegThreshold'] = p90 > threshold
        if i > 0 and out[i]['P90_30'] is not None and out[i - 1]['P90_30'] is not None:
            out[i]['Crosses_Above_Threshold'] = out[i]['Exceeds_RegThreshold'] and not out[i - 1]['Exceeds_RegThreshold']
            out[i]['Crosses_Below_Threshold'] = not out[i]['Exceeds_RegThreshold'] and out[i - 1]['Exceeds_RegThreshold']

    return out

station_ecoli = [r for r in ecoli if r['Catchment'] == selectedStation]
station_fecal = [r for r in fecal if r['Catchment'] == selectedStation]
collapsed_ecoli = collapse(station_ecoli)
collapsed_fecal = collapse(station_fecal)
ecoli_stats = add_rolling_stats(collapsed_ecoli, 320)
fecal_stats = add_rolling_stats(collapsed_fecal, 34)

# chart series creation
series_map = {}

def key(date):
    return date.date().isoformat()

for row in precip:
    if start <= row['Date'] <= end:
        series_map[key(row['Date'])] = {
            'date': row['Date'],
            'Precip_in': row['Precip_in'],
            'EcoliValue': None,
            'EcoliGMV': None,
            'FecalValue': None,
            'FecalGMV': None,
        }

for row in ecoli_stats:
    if start <= row['Date'] <= end:
        point = series_map.setdefault(key(row['Date']), {
            'date': row['Date'],
            'Precip_in': 0,
            'EcoliValue': None,
            'EcoliGMV': None,
            'FecalValue': None,
            'FecalGMV': None,
        })
        point['EcoliValue'] = row['Value']
        point['EcoliGMV'] = row['GMV30']

for row in fecal_stats:
    if start <= row['Date'] <= end:
        point = series_map.setdefault(key(row['Date']), {
            'date': row['Date'],
            'Precip_in': 0,
            'EcoliValue': None,
            'EcoliGMV': None,
            'FecalValue': None,
            'FecalGMV': None,
        })
        point['FecalValue'] = row['Value']
        point['FecalGMV'] = row['GMV30']

series = sorted(series_map.values(), key=lambda x: x['date'])
print('range', series[0]['date'].date(), series[-1]['date'].date())
print('first plotted EcoliGMV rows', [x for x in series if x['EcoliGMV'] is not None][:5])
print('first plotted FecalGMV rows', [x for x in series if x['FecalGMV'] is not None][:5])
print('count rows', len(series))
