data {
  int<lower=1> n_ctrs;
  int<lower=1> n_obs;
  array[n_ctrs] int ctr_budgets;
  array[n_obs] int<lower=1, upper=10> ctrs;
  array[n_obs] int<lower=1, upper=10> positions;
}
parameters {
  array[n_ctrs] real<lower=1, upper=10> lambda;
}
model {
  lambda ~ normal(ctr_budgets, 1);
  positions ~ normal(lambda[ctrs], 1) T[1, 10];

  // the above "distribution" syntax is equivalent to:
  //target += uniform_lpdf(lambda | 1, 10);
  //target += poisson_lpmf(positions | lambda[ctrs]);
}
