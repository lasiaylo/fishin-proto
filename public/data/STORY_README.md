# Writing story beats (Story.csv)

Each row in `Story.csv` is one story beat. A beat happens **once**, the first
time its condition becomes true.

| column   | what to put there                                                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `when`   | When the beat happens, e.g. `fish >= 3`. Combine with `and`: `sits >= 2 and money >= 50`.                                                          |
| `text`   | The line shown in the event log. To pick one at random, separate options with `\|`: `the wind picks up\|a gull cries overhead`. Can be left empty. |
| `action` | Optional. Something the game does when the beat happens (see below).                                                                               |

## Things `when` can check

- `casts` — total casts so far
- `fish` — total fish caught
- `sits` — total times sat in the fields
- `money` — current wallet

Comparisons: `>=`, `<=`, `>`, `<`, `=`

## Actions

- `unlock pond` — opens the pond tab
- `unlock sky` — opens the sky tab

Ask a developer to add more.

## Tips

- Edit in Google Sheets or Excel and export/save as CSV. If a line contains a
  comma, the spreadsheet will wrap it in quotes for you — that's fine.
- If hand-editing, wrap text containing commas in double quotes: `"well, well"`.
- A row starting with `#` is ignored — handy for switching a beat off.
- Save the file and refresh the game page to see changes.
- If a row has a mistake (a misspelled stat or action), the game skips it and
  prints a warning naming the row in the browser console.
