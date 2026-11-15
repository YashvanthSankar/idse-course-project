# Website: future work

Ideas for future work on the `/model` site. These are proposals, not features that are already available. The model describes historical Tamil Nadu cases; new interactions should make that scope and its limitations clear.

## Ask visitors and respond

- [ ] Add an optional guided case questionnaire: case topic, district, court and procedure, with plain-language explanations for each choice.
- [ ] Let visitors change the filing month and see its effect, using the model's existing month input; explain that congestion values are historical.
- [ ] Add a searchable “other case” flow for supported case type, law and section combinations; validate combinations against exported model inputs and show coverage or fallback warnings.
- [ ] Show a clear response to each selection: the one-year estimate, typical historical duration, main factors, and the evidence behind them. Distinguish descriptive timing curves from model predictions.
- [ ] Offer useful follow-up prompts such as “Compare another district”, “Why this result?” and “See similar historical cases”. Preserve the visitor's selections between views.
- [ ] Let visitors send optional feedback about confusing explanations or missing case types. Decide where feedback is stored, explain what is collected, and avoid requesting identifiable case details.
- [ ] Consider a question-and-answer interface grounded in the project report and exported data, with citations and an explicit “I don't know” response. Define evaluation and operating costs before implementation.

## Interactive exploration

- [ ] Link a selected case type or district in the charts directly to a prefilled case explorer.
- [ ] Add side-by-side comparisons of several case types or districts, with consistent scales and a shareable URL.
- [ ] Add chart filters for filing year and court level only where exported aggregates support them; label sample sizes and unavailable combinations.
- [ ] Expand timeline controls with direct point selection and keyboard-friendly descriptions; retain data tables and download options.
- [ ] Add an optional “What if?” view that changes supported filing-day features and explains which model inputs actually changed.
- [ ] Let visitors save or share a view with selections in the URL, without putting personal case details in it.

## Usability and project presentation

- [ ] Add a short guided tour from the home page through the case explorer, data stories and method.
- [ ] Improve loading, empty, offline and API-error states, including a retry action.
- [ ] Audit mobile layouts, keyboard navigation, focus states, screen-reader descriptions and contrast across all charts.
- [ ] Provide motion controls and a useful static tree presentation for visitors who prefer reduced motion.
- [ ] Add a glossary for legal and modelling terms, with links to verified sources.
- [ ] Add data and chart downloads with clear source, date range and licence information.
- [ ] Offer language options after translations are reviewed for accuracy.

## Data and model work

- [ ] Surface coverage and model limitations beside results, including the historical data period and weak ranking within a case type.
- [ ] Evaluate calibration and performance by district and case type before presenting finer-grained comparisons.
- [ ] Investigate newer data or additional states only when suitable, licensed sources and comparable coverage are available.
- [ ] Add API and end-to-end tests for each new interaction, including invalid inputs and fallback behavior; update the pipeline documentation for changes to modelling or cleaning rules.
