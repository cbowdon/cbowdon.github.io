library(tidyverse)
library(httr2)
library(ellmer)

API_KEY <- Sys.getenv("YOUTUBE_API_KEY")
HTTR2_CACHE <- ".httr2_cache"

search_videos <- function(
  query,
  published_after = "2026-01-01T00:00:00Z",
  published_before = "2026-01-02T00:00:00Z"
) {
  query <- trimws(paste(query, collapse = " "))

  req <- request("https://youtube.googleapis.com/youtube/v3/search") |>
    req_cache(HTTR2_CACHE) |>
    req_url_query(
      part = "snippet",
      q = query,
      type = "video",
      maxResults = 50,
      duration = "short",
      region = "UK",
      published_after = published_after,
      published_before = published_before,
      key = API_KEY
    ) |>
    req_headers(Accept = "application/json") |>
    req_timeout(30)

  resp <- req_perform(req)
  if (resp_is_error(resp)) {
    stop("YouTube API request failed: HTTP ", httr2::resp_status(resp))
  }

  resp_body_json(resp, simplifyVector = TRUE)
}

query <- "\"deadlift PR\" -anatoly"

search_videos(query)

dates <- seq(as.Date("2020-01-01"), as.Date("2025-12-01"), by = "month")

afters <- dates[-length(dates)]
befores <- dates[-1]

query_results <- purrr::map2(
  afters,
  befores,
  .f = function(a, b) {
    search_videos(
      query,
      published_after = sprintf("%sT00:00:00Z", a),
      published_before = sprintf("%sT00:00:00Z", b)
    )
  },
  .progress = TRUE
)

df <- query_results |>
  purrr::map(\(r) unnest(r$items, snippet)) |>
  bind_rows() |>
  mutate(publish.date = as.Date(df$publishedAt))

extract_dl_weight_chat <- {
  system_prompt <- "The user will provide the title and description of a YouTube video. If they describe a weight being deadlifted, you must extract the amount that was deadlifted and the unit.

Return your answer in a JSON object with keys `weight` (numeric) and `unit` (kg, lb or n/a). 
Do not perform unit conversion.
Return n/a as the unit if the description doesn't mention a weight deadlifted or the unit isn't clear."

  turns <- list(
    UserTurn(list(ContentText(
      "Title: 300kg deadlift PR\nDescription: hit this at my meet"
    ))),
    AssistantTurn(list(ContentText("{\"weight\":300, \"unit\":\"kg\"}"))),
    UserTurn(list(ContentText(
      "Title: 585 lb pull at 198 bodyweight\nDescription: new deadlift personal record"
    ))),
    AssistantTurn(list(ContentText("{\"weight\":585, \"unit\":\"lb\"}"))),
    UserTurn(list(ContentText(
      "Title: Big deadlift day\nDescription: felt strong today"
    ))),
    AssistantTurn(list(ContentText("{\"weight\":0, \"unit\":\"n/a\"}")))
  )

  chat <- chat_openai_compatible(
    "http://localhost:1234/v1",
    model = "mistralai/ministral-3-3b",
    credentials = function() "",
    params = params(max_tokens = 50),
    system_prompt = system_prompt
  )

  chat$set_turns(turns)
  chat
}

extract_dl_type <- type_object(
  weight = type_number("The weight deadlifted, as a number."),
  unit = type_enum(values = c("kg", "lb", "n/a"))
)

# Example use
extract_dl_weight_chat$chat_structured(
  "Title: 665 lbs deadlift at 188 lbs weight #deadlift #pr #powerlifting #powerlifter #usapl #ipf #shortsfeed\nDescription: ",
  type = extract_dl_type
)

extractions <- parallel_chat_structured(
  chat = extract_dl_weight_chat,
  prompts = df |>
    mutate(
      prompt = interpolate("Title: {{title}}\nDescription: {{description}}")
    ) |>
    pull(prompt),
  type = extract_dl_type,
  max_active = 5
)

df$weight.kg <- extractions |>
  mutate(
    weight.kg = case_when(
      unit == "kg" ~ as.numeric(weight),
      unit == "lb" ~ as.numeric(weight) * 0.45359237,
      .default = NA
    )
  ) |>
  pull(weight.kg)

ggplot(df) +
  aes(x = publish.date, y = weight.kg) +
  geom_point() +
  geom_smooth(method = "lm")

ggplot(
  df |> mutate(yr = year(publish.date))
) +
  aes(x = weight.kg) +
  facet_wrap(~yr, ncol = 1) +
  geom_histogram(binwidth = 10) +
  scale_x_continuous(breaks = scales::breaks_width(50)) +
  theme_minimal()

saveRDS(df, file = "posts/gymflation/youtube_df.rds", compress = FALSE)
df <- readRDS("posts/gymflation/youtube_df.rds")
