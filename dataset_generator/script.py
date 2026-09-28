import pandas as pd
train = pd.read_csv("../data/claims_train.csv")
val = pd.read_csv("../data/claims_val.csv")
test = pd.read_csv("../data/claims_test.csv")

all_codes = pd.concat([train.claim_code, val.claim_code, test.claim_code])
print("rows:", len(all_codes), "unique:", all_codes.nunique())   # must be equal
print(train.label.value_counts())