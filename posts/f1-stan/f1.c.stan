data {
  int<lower=1> n_ctrs;
  int<lower=1> n_drvs;
  int<lower=1> n_obs;
  array[n_ctrs] real ctr_mus;
  real<lower=0> ctr_sd;
  array[n_obs] int<lower=1, upper=20> positions;
  array[n_obs, 2] int position_indices;
}
parameters {
  real<lower=0> sigma;
  vector[n_ctrs] lambda_ctrs_raw;
  vector[n_drvs] lambda_drvs_raw;
}
transformed parameters {
  vector[n_ctrs] lambda_ctrs;
  vector[n_drvs] lambda_drvs;
  
  // Apply constraints to ensure identifiability
  lambda_ctrs = inv_logit(lambda_ctrs_raw);
  lambda_drvs = inv_logit(lambda_drvs_raw);
}
model {
  sigma ~ std_normal();
  lambda_ctrs_raw ~ normal(ctr_mus, ctr_sd);
  lambda_drvs_raw ~ std_normal();
  
  for (k in 1 : n_obs) {
    int i = position_indices[k, 1];
    int j = position_indices[k, 2];
    positions[k] ~ normal(10/exp(1) * exp(lambda_ctrs[i] + lambda_drvs[j]), sigma);
  }
}
