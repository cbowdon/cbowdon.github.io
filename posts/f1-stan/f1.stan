data {
  int<lower=1> n_ctrs;
  int<lower=1> n_obs;
  array[n_obs] int<lower=1, upper=10> ctrs;
  array[n_obs] int<lower=1, upper=10> positions;
}
parameters {
  array[n_ctrs] real<lower=1, upper=10> lambda;
}
model {
  lambda ~ uniform(1, 10);
  positions ~ poisson(lambda[ctrs]) T[1, 10];

  // the above "distribution" syntax is equivalent to:
  //target += uniform_lpdf(lambda | 1, 10);
  //target += poisson_lpmf(positions | lambda[ctrs]);
}
