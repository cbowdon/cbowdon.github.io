data {
  // Observed data
  int n_data;
  array[n_data] real x_data;
  array[n_data] real y_data;
  
  // Observation error
  real<lower=0> sigma;
  
  // x values for which we aim to predict y
  int n_pred;
  array[n_pred] real x_pred;
  
  // Hyperparameters for the kernel
  real alpha;
  real lambda;
}
transformed data {
  // We join the x observations and desired x prediction points
  int n = n_data + n_pred;
  
  array[n] real x;
  x[1 : n_data] = x_data;
  x[(n_data + 1): n] = x_pred;
  
  // We calculate the Kernel values for all x
  matrix[n, n] K;
  K = gp_exp_quad_cov(x, alpha, lambda);
  
  // Add nugget on diagonal for numerical stability
  for (i in 1 : n) {
    K[i, i] = K[i, i] + 1e-6;
  }

  // Here we do the Cholesky decomposition
  matrix[n, n] L;
  L = cholesky_decompose(K);
}
parameters {
  // This has changed from being f to being eta
  vector[n] eta;
}
transformed parameters {
   // f is now calculated from eta and L (mu is 0)
   vector[n] f = L * eta;
}
model {
  // Likelihood is tested against the observations
  y_data ~ normal(f[1 : n_data], sigma);

  // f is sampled from GP, which has been reparameterised
  // This time we're sampling eta and computing f
  eta ~ normal(0, 1);
}
