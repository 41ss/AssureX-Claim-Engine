# dataset_generator/  (owner: Victor)

Scripts that create the common warranty claim dataset (SRS xvii, 1.10.3).

Must produce: 1,500 unique claims (500 Valid Claim / 500 Invalid Claim / 500 Manual Review),
covering normal, incomplete, contradictory, complex and borderline scenarios; a stratified
70/15/15 split (1,050 / 225 / 225) written to `data/`; claim scenario definitions; dataset
statistics; and the Claim ID to card-image filename mapping file.
