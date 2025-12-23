from backend.core.processor import process_csv
import os

def test_real_data():
    file_path = r"c:\Users\lkwas\Desktop\Data_engineering\trading_dashboard\data\trades_export.csv"
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, 'rb') as f:
        try:
            result = process_csv(f)
            print("Successfully processed real data file.")
            print("Stats Summary:", result['stats']['summary'])
        except Exception as e:
            print(f"Failed to process file: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    test_real_data()
