# usage-glance

A lightweight Claude mod that adds one row above the prompt showing your **Session (5h)** and **Week (7d)** rate-limit usage in more detail, plus how full the **Context** window is.

- Each bar is usage; the thin `│` marks how far through the window time has gone, so you can see at a glance whether you're ahead of or under pace.
- Reset countdowns are in whole minutes, so only real changes redraw the row.
- Colors: soft peach normally, soft yellow from 70%, clay-red from 90%.
- Hides itself when there is no reading yet (needs a subscription and one reply) or a survey is showing.

## Install

At the prompt of a terminal session:

```
/plugin install usage-glance --marketplace devonsa55/usage-glance
```

From a shell:

```
claude plugin install usage-glance --marketplace devonsa55/usage-glance
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `devonsa55/usage-glance`, then Add plugin.

This repository is public; no GitHub credential is needed to install it.
