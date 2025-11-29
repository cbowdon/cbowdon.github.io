model {
  // f_x is sampled from the GP.
  // Remember it's a vector of f(x), not parameters describing f.
  f_x ~ multi_normal(rep_vector(0, n), K);

  // Likelihood is evaluated on f(x) plus normally distributed noise.
  y_obs ~ normal(f[1 : n_obs], sigma);

}
parameters {
  // Our outputs will be f(x) for all x (our observations, x_obs, and the predictions we want, x_pred)
  vector[n] f_x;
}
data {
  // Observed data
  int n_obs;
  array[n_obs] real x_obs;
  array[n_obs] real y_obs;
  
  // Observation error - pick a value
  real<lower=0> sigma;
  
  // x values for which we aim to predict f(x)
  int n_pred;
  array[n_pred] real x_pred;
  
  // Hyperparameters for the kernel
  real alpha;
  real lambda;
}
transformed data {
  // We join the x observations and desired x prediction points
  // because we want f(x) for both observed data and new predictions
  int n = n_obs + n_pred;
  
  array[n] real x;
  x[1 : n_obs] = x_obs;
  x[(n_obs + 1): n] = x_pred;
  
  // We calculate the Kernel values for all observed x
  matrix[n, n] K;
  K = gp_exp_quad_cov(x, alpha, lambda);
  
  // Add "nugget" on diagonal for numerical stability
  for (i in 1 : n) {
    K[i, i] = K[i, i] + 1e-6;
  }
}