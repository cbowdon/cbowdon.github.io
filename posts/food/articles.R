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
  "ft.com"
)

load_upf_articles <- function() {
  jsonlite::read_json(
    "data/titles_plus_highlights.json",
    simplifyVector = T
  ) |>
    unnest("_source") |>
    unnest("highlight") |>
    filter(domain %in% DOMAINS) |>
    mutate(
      domain = factor(domain, levels = DOMAINS, ordered = TRUE),
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
    filter(domain %in% DOMAINS) |>
    mutate(domain = factor(domain, levels = DOMAINS, ordered = TRUE)) |>
    unnest("by_date") |>
    unnest("buckets") |>
    rename(period = key_as_string, n_articles = doc_count) |>
    mutate(period = as.Date(period)) |>
    filter(period >= "2024-01-01" & period < "2025-06-01") |>
    select(-key)
}

# ggplot(domain_counts) + aes(x = period, y = n_articles, group = domain, colour = domain) + geom_line()

# ggplot(upf_articles) + aes(x = period, group=domain, fill=domain) + geom_histogram(stat = "count")
