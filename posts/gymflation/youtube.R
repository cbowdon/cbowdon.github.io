library(tidyverse)
library(httr2)
library(ellmer)
library(memoise)
library(cachem)

set.seed(42)

API_KEY <- Sys.getenv("YOUTUBE_API_KEY")
LLM_SERVER_URL <- "http://localhost:8080/v1"

search_videos_cache <- cache_disk(".cache/youtube")

search_videos <- memoise(
  function(
    query,
    published_after = "2026-01-01T00:00:00Z",
    published_before = "2026-01-02T00:00:00Z"
  ) {
    query <- trimws(paste(query, collapse = " "))

    req <- request("https://youtube.googleapis.com/youtube/v3/search") |>
      req_cache(".cache/httr2") |> # only works for GET :(
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
  },
  cache = search_videos_cache
)

query <- "\"deadlift PR\" -anatoly"

search_videos(query)

dates <- seq(as.Date("2015-01-01"), as.Date("2025-12-01"), by = "month")

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
  mutate(publish.date = as.Date(publishedAt)) |>
  unnest(c(id, thumbnails), names_sep = ".") |>
  unnest(starts_with("thumb"), names_sep = ".")

# We will need to check accuracy, otherwise we've not delegated a task to AI we've delegated it to a magic 8-ball.
# I'm dumping a small sample into a CSV to be labelled manually, which I'd always recommend in the first instance so that you get to know your own data.
# If you need a larger sample then it could be delegated to a larger LLM than the one you are using (which may or may not equal human accuracy on this task... you may need to evaluate your evaluator...)
# Another approach is to code your own labelling app so that a human can label as efficiently as possible - but beware human bias and error too.
df |>
  slice_sample(n = 100) |>
  select(id.videoId, title, description) |>
  write_csv("posts/gymflation/data/unannotated-weight.csv")

# Annotate and save as a new file

epley_1rm <- function(weight_kg, reps) {
  round(weight_kg * (1 + reps / 30) * 2) / 2
}

labels <- read_csv("posts/gymflation/data/annotated-weight.csv") |>
  filter(reviewed) |>
  mutate(
    weight.kg = convert_kg(weight, unit),
    weight.kg.1rm = epley_1rm(weight.kg, reps)
  )

eval_acc <- function() {}

# Example use
extract_dl_weight_chat(turns)$chat_structured(
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
    weight.kg = convert_kg(weight, unit)
  ) |>
  pull(weight.kg)

world.records <- read_csv("posts/gymflation/data/deadlifts.csv")

df |> filter(weight.kg < max(world.records$kg))

df$form <- if_else(
  str_detect(df$title, "sumo") | str_detect(df$description, "sumo"),
  "sumo",
  "conventional"
)

df$year <- year(df$publish.date)

hline <- function(yint.kg) {
  geom_hline(
    aes(yintercept = yint.kg),
    alpha = 0.5,
    linetype = "dashed",
    colour = "red"
  )
}

ggplot(df) +
  aes(x = publish.date, y = weight.kg, colour = gender) +
  geom_point(alpha = 0.9, size = 1) +
  geom_smooth() +
  hline(200 / 2.2) +
  hline(300 / 2.2) +
  hline(400 / 2.2) +
  hline(500 / 2.2) +
  hline(600 / 2.2)

ggplot(df) +
  aes(x = weight.kg) +
  #facet_grid(rows = vars(form), cols = vars(year), scales = "free_y") +
  facet_wrap(~form, ncol = 1, scales = "free_y") +
  geom_histogram()

# Anova test finds no difference due to form
anova(lm(weight.kg ~ form, data = df))
summary(lm(weight.kg ~ form + year, data = df))
fit <- lm(weight.kg ~ form + factor(year), data = df)
summary(fit)
anova(fit)
drop1(fit, test = "F")
# indicates that form makes no difference

ggplot(df) +
  aes(x = weight.kg) +
  facet_wrap(~year, ncol = 1) +
  geom_histogram(binwidth = 10) +
  scale_x_continuous(breaks = scales::breaks_width(50)) +
  theme_minimal()

ggplot(
  df |>
    group_by(channelId) |>
    summarise(
      diff.kg = max(weight.kg) - min(weight.kg),
      diff.days = as.numeric(
        max(publish.date) - min(publish.date),
        units = "days"
      ),
      kg.per.day = diff.kg / diff.days,
      annual.kg = 356 * kg.per.day
    ) |>
    filter(diff.kg > 0) |>
    filter(annual.kg < 250)
) +
  aes(x = annual.kg) +
  geom_histogram() +
  scale_x_continuous(breaks = scales::breaks_width(25)) +
  theme_minimal()

video_id <- "VOCYVw2QxYU"

video_img_req <- function(video_id) {
  request(sprintf("https://i.ytimg.com/vi/%s/hqdefault.jpg", video_id)) |>
    req_cache(".cache/httr2")
}

image_resps <- unnest(df$id, cols = c())$videoId |>
  map(~ video_img_req(.)) |>
  req_perform_parallel()

save_image <- function(resp) {
  img_file <- gsub("/", "_", resp_url_path(resp), fixed = TRUE) |>
    str_replace("^", "posts/gymflation/data/stills/")
  con <- file(img_file, open = "wb")
  writeBin(resp_body_raw(resp), con)
  close(con)
  img_file
}

image_resps |> map(save_image, .progress = TRUE)
image_paths <- unnest(df$id, cols = c())$videoId |>
  map(~ sprintf("posts/gymflation/data/stills/_vi_%s_hqdefault.jpg", .))

predict_gender_chat <- {
  system_prompt <- "The user will provide an image.  You must predict the gender of the main person in the image.
Return your answer in a JSON object with a single key `gender` with value `M`, `F` or `NA`.
Respond NA if you can't tell or there is no one in the image."

  chat_openai_compatible(
    LLM_SERVER_URL,
    model = "mistralai/ministral-3-3b",
    credentials = function() "",
    params = params(max_tokens = 50),
    system_prompt = system_prompt
  )
}

predict_gender_type <- type_object(
  gender = type_enum(values = c("M", "F", "NA"))
)

# Example use
predict_gender_chat$chat_structured(
  content_image_file(image_paths[[1]]),
  type = predict_gender_type
)

gender_predictions <- parallel_chat_structured(
  chat = predict_gender_chat,
  prompts = 1:length(image_paths) |>
    map(~ content_image_file(image_paths[[.]])),
  type = predict_gender_type,
  max_active = 5
)

df$gender <- gender_predictions |>
  mutate(gender = if_else(gender == "NA", NA, gender)) |>
  pull(gender)

ggplot(df |> drop_na(gender)) +
  aes(x = publish.date, y = weight.kg) +
  facet_wrap(~gender) +
  geom_point(alpha = 0.5, size = 0.5)

saveRDS(df, file = "posts/gymflation/youtube_df.rds", compress = FALSE)
df <- readRDS("posts/gymflation/youtube_df.rds")
