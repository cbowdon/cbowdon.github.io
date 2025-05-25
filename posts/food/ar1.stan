data {
  int<lower=0> N;
  vector[N] y;
  real<lower=0, upper=5> sigma; // should be param but model not identifiable
}
parameters {
  real<lower=0, upper=1> phi;
  real<lower=0, upper=1> c;
}
model {
  phi ~ uniform(0, 1);
  c ~ normal(0, 0.25);
  //sigma ~ normal(0, 0.05);
  for (t in 2 : N) {
    y[N] ~ normal(phi * y[t - 1] + c, sigma);
  }
}
generated quantities {
  vector[N - 1] log_lik;
  vector[N - 1] residuals;
  
  for (t in 2 : N) {
    real mu = c + phi * y[t - 1];
    residuals[t - 1] = y[t] - mu;
    log_lik[t - 1] = normal_lpdf(y[t] | mu, sigma);
  }
}

