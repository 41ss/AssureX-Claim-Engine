# sample_claims/

- `demo_claims.csv`: every demonstration case the SRS asks for (1.10.8) with its inputs and the
  expected result. `python database/seed_db.py` creates these claims in the app.
- `documents/`: images to upload by hand when trying the New Claim flow. The receipts are read
  by OCR; `receipt_galaxy_a55_wrong_serial.png` shows a different serial number, so using it on
  the Galaxy A55 triggers the serial-number mismatch check.

The 225 unseen test claims used for the model comparison are in `data/claims_test.csv`.
