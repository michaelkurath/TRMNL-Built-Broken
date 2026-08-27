# Built & Broken

<img width="112" alt="Built &amp; Broken icon" src="assets/icon.svg" />

An open-source [TRMNL](https://trmnl.com/) recipe presenting one carefully sourced engineering breakthrough or failure each day—and the lesson engineers can take from it.

The recipe is connected through [GitHub Sync](https://help.trmnl.com/en/articles/15977899-github-sync), keeping changes made in TRMNL and this repository aligned.

<img width="150" alt="Works with TRMNL" src="https://trmnl.com/images/brand/badges/light/works-with-trmnl/trmnl-badge-works-with-light.svg" />

## Concept

Each case contains:

- the historical event and year
- a concise, factual explanation
- the relevant engineering discipline
- an original engineering lesson
- a link to an authoritative source

When the dataset contains an event matching the current month and day, that anniversary is shown. Otherwise, the recipe uses the local day of year to select a stable daily case. The same case therefore remains visible all day rather than changing on every refresh.

## Current status

The dataset currently contains 186 sourced cases split evenly between breakthroughs and failures. The long-term target is one curated anniversary for every day of the year.

### Categories

Cases use one of 21 normalized categories:

- Aviation
- Automotive Engineering
- Civil Engineering
- Communications
- Computing
- Consumer Technology
- Electrical Engineering
- Energy Engineering
- Environmental Engineering
- Fire Safety
- Food & Agricultural Engineering
- Manufacturing & Automation
- Marine Engineering
- Materials Engineering
- Medicine
- Mining & Tunneling
- Nuclear Engineering
- Process Engineering
- Rail
- Software & Systems
- Space

## Settings

- Show both types, breakthroughs only, or failures only
- Choose a stable daily case or a new random case on each render
- Show or hide the event summary
- Optionally show the source name
- Full, half-horizontal, half-vertical, and quadrant layouts

## Repository structure

```text
assets/icon.svg          Scalable project icon
assets/icon.png          Transparent 512 px icon
data/events.json          Curated engineering cases
src/full.liquid           Full-screen layout
src/half_horizontal.liquid
src/half_vertical.liquid
src/quadrant.liquid
src/shared.liquid         Shared visual styling
src/settings.yml          TRMNL recipe configuration
```

## Data format

```json
{
  "events": [
    {
      "id": "mini-1959",
      "month_day": "08-26",
      "year": 1959,
      "type": "breakthrough",
      "discipline": "Automotive Engineering",
      "title": "The Mini turns packaging into the innovation",
      "summary": "What happened and why it mattered.",
      "lesson": "The transferable engineering lesson.",
      "source_label": "BMW Group Archive",
      "source_url": "https://example.com/source"
    }
  ]
}
```

The polling response must contain a non-empty `events` array. Templates show a data-unavailable state if the array is missing or empty, and provide readable defaults when an individual display field is absent.

## Development

Templates and settings live in [`src/`](src/), ready for [trmnlp](https://github.com/usetrmnl/trmnlp):

```sh
gem install trmnl_preview
trmnlp serve
```

During local development, use `data/events.json` as the polling response. Before importing into TRMNL, ensure the polling URL in `src/settings.yml` points to the raw JSON file in the published repository.

Add the `trmnl` topic to the repository so other TRMNL plugin builders can find it.

## Editorial rules

- Prefer investigation bodies, operators, government archives, museums, universities, and original project organizations.
- Separate documented facts from the original engineering lesson.
- Avoid myths and simplified failure explanations when the official investigation is more nuanced.
- Keep summaries understandable without removing the decisive technical detail.
- Use one of the normalized category names listed above; do not introduce synonyms for an existing category.
- Choose the primary user-facing domain for `discipline`; keep cross-cutting causes such as fatigue, corrosion, human factors or software interfaces in the summary and lesson until tag support exists.
- Never present fatalities as entertainment; focus on the system and the lesson.

## License

Original markup, styling, summaries, and lessons are licensed under [CC BY 4.0](./LICENSE), consistent with the [TRMNL Community Plugin License](https://trmnl.com/plugin-license). Linked source material remains subject to its respective owner's terms.
