library(tidyverse)

DOMAINS <- c(
  "bbc.co.uk",
  "theguardian.com",
  "dailymail.co.uk",
  "independent.co.uk",
  "express.co.uk",
  "mirror.co.uk",
  "telegraph.co.uk",
  "standard.co.uk",
  "metro.co.uk",
  "thetimes.co.uk",
  "ft.com"
)

load_upf_articles <- function() {
  jsonlite::read_json(
    "data/titles_plus_highlights.json",
    simplifyVector = T
  ) |>
    unnest("_source") |>
    unnest("highlight") |>
    mutate(
      harvestTime = as.Date(harvestTime),
      period = as.Date(strftime(harvestTime, "%Y-%m-01")),
      is_focus = str_detect(str_to_lower(title), "ultra")
    ) |>
    select(-starts_with("_")) |>
    filter(period >= "2024-01-01" & period < "2025-06-01") |>
    rename(highlights = content)
}


load_domain_counts <- function() {
  jsonlite::read_json("data/aggs.json", simplifyVector = T) |>
    rename(domain = key, total = doc_count) |>
    unnest("by_date") |>
    unnest("buckets") |>
    rename(period = key_as_string, n_articles = doc_count) |>
    select(-key)
}

# ggplot(domain_counts) + aes(x = period, y = n_articles, group = domain, colour = domain) + geom_line()

# ggplot(upf_articles) + aes(x = period) + geom_histogram(stat = "count")
