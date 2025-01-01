data {
  int<lower=1> n_ctrs;
  int<lower=1> n_obs;
  array[n_ctrs] int<lower=1, upper=10> prior_mus;
  real<lower=0> prior_sd;
  array[n_obs] int<lower=1, upper=10> ctrs;
  array[n_obs] int<lower=1, upper=10> positions;
}
parameters {
  array[n_ctrs] real<lower=1, upper=10> lambda;
}
model {
  lambda ~ normal(prior_mus, prior_sd);
  positions ~ normal(lambda[ctrs], 1) T[1, 10];
}
