# Ingrid's Notes — Week 1

## What I'm Watching

Three things will tell me whether we're on track or repeating cycle 1:

### 1. The Validation Conversation Actually Happens
I've flagged this as the blocker. I mean it. If we get to Friday and someone says "We were too busy" or "We'll do it next week," I'm pulling the project. 

One engineer. Twenty minutes. Before we write code.

The reason: I've seen three blocker products fail at this company because we *assumed* the problem existed. Assumptions about developer pain are the cheapest lies we tell ourselves.

### 2. Scope Lock Holds
I know the team wants to ship fast. I know "narrower scope" feels like progress. But narrower scope on a problem nobody asked for is still a waste. 

The scope lock checklist is not bureaucracy. It's the difference between "we found the real problem and solved it in 4 weeks" and "we shipped Deploy Guard v2 and learned in week 6 that nobody uses it."

If I see the word "later" or "we'll add support for" in a PR description this week, I'm re-opening risk #2.

### 3. The Team's Honesty About Why Deploy Guard Failed
Risk #5 is the one I'm least confident I've articulated well. Here's what I mean:

We know Deploy Guard failed. We're less clear on *why*. Was it:
- A solution nobody needed?
- A solution everyone needed but we built it wrong?
- A solution the right customer needed, but we picked the wrong customer?

If we can't answer that clearly by Friday, we're not ready to build v2 yet. We're just hoping.

---

## My Reputation Stake

I've been critical about blockers before. I called Deploy Guard wrong in cycle 1. I said the same thing would happen in cycle 2 when we revisited it. 

If I'm wrong again and this actually ships and people pay for it, I'll acknowledge it. If I'm right and we repeat the same failure, I'll say "I told you so" once and then move on to fixing it.

But I'm not going to let the team build without validation again. That's not being a good Devil's Advocate. That's being asleep.

---

## What Would Change My Mind

If the validation conversation shows:
- "This costs us 4+ hours per incident, and we have 2–3 incidents per quarter"
- "We've built internal tools to try to solve this and they don't work well"
- "We'd adopt a tool like this today if it existed"

Then I say: "Build it. Lock scope. Ship it in 4 weeks. I'll stop pushing back."

What won't change my mind:
- "This could save us time" (speculative)
- "Our team would probably use it" (untested)
- "We think there's a market for this" (hope)

Real signal only.

---

## Runway Math

We have 9 months. If this project takes 6 weeks to ship and 2 more weeks to figure out it's a dead end (like Deploy Guard), we've spent 8 weeks and have 30 weeks of runway left.

If we validate first (1 week) and learn it's not a real problem, we save those 6 weeks and pivot Monday morning of week 2.

The validation conversation is the cheapest risk mitigation we can buy.