import csv
import datetime
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
print('ecoli', len([r for r in ecoli if r['Catchment'] == 'Chico Creek' and start <= r['Date'] <= end]))
print('fecal', len([r for r in fecal if r['Catchment'] == 'Chico Creek' and start <= r['Date'] <= end]))
print('precip', len([r for r in precip if start <= r['Date'] <= end]))
