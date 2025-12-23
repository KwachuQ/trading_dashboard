import requests
import json

url = 'http://localhost:8000/upload'
files = {'file': open('data/trades_export.csv', 'rb')}

try:
    response = requests.post(url, files=files)
    if response.status_code == 200:
        data = response.json()
        print(f"Avg Duration from Backend: {data['stats']['duration']['avg_duration']}")
        print(f"Total Trades: {data['stats']['summary']['total_trades']}")
        
        # Check first few trades in data to see their duration
        print("\nFirst 3 trades duration:")
        for t in data['data'][:3]:
            print(f"Date: {t['Date']}, Duration: {t['Duration']}")
            
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"Exception: {e}")
