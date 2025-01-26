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
}
parameters {
  // This is what we want to estimate
  vector[n] f;
}
model {
  // Likelihood is tested against the observations
  y_data ~ normal(f[1 : n_data], sigma);

  // f is sampled from GP
  // The domain of the GP prior is all x
  // We assume the mean is always 0
  f ~ multi_normal(rep_vector(0, n), K);
}
