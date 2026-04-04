+++
title = 'Designing a Fair Booking System Is Harder Than It Looks'
date = 2026-04-03T15:33:18+02:00
draft = false
toc = true
tags = ['postgres', 'concurrency', 'backend', 'software-design', 'nestjs', 'prisma']
tldr = 'Why naive SQL and job queues both failed for fair, fast hotel booking—and how atomic Postgres selection with row locking fixed it until scale pushes you to rethink again.'
description = 'Building a convention hotel booking system with NestJS: race conditions from naive SQL, why BullMQ queues fixed consistency but hurt latency and fairness, and a Postgres pattern using transactions and FOR UPDATE SKIP LOCKED to balance all three.'
+++

Imagine you’re organizing an event and open the registration.

100 users want to get a room at the same time.
You have 30 rooms...What could go wrong? ... *a lot* ^^

## The Problem

As an urgent request from a local convention, I was asked to write a hotel booking system with a few constraints:
- Limited number of rooms (~500 in total)
- Different room tiers (with a quota per tier)
- User picks a tier and gets assigned a room
- Allocation should feel fair (FCFS, not a lottery)
- The system should respond quickly

*At first glance, this might sound simple.*

## The (very) Naive Approach

The most straightforward implementation looks like this:
1. Query for a room that is not occupied yet `(user_id = NULL)`
2. Assign it to the user
3. Done

I hope it does not need to be explained why this is not a great idea. The query to get a room will with a high confidence return the same room id for parallel requests.

The race condition appears when both users get the same room as response and try to claim it.

## The (still) Naive Approach

An *improvement* of this implementation would be some kind of randomization logic:
1. Query available rooms
2. Pick one randomly
3. Assign it to the user

**Why does this still cause an issue with concurrency?**

Two users can still pick the same room, especially with decreasing number of available quota, what the possibility per room significantly increases.

The race condition still applies and the user gets a failing request.

## The “Obvious” Approach: Use a Queue

The thought process was simple:

> Let’s just serialize the booking process.

Since I was writing my backend with NestJS, I considered writing a queue system with e.g. BullMQ:
- Each booking requests gets queued
- Workers process them one by one (FIFO)
- no race conditions, because the room selection happens in the worker task

Problem solved? Not really...

Te queue *did* fix consistency, but it introduced a long latency. Sizing a queue is difficult enough, but maintaining a level of fairness made it feel impossible.

**The direct problem here:** There are different room tiers, cheaper rooms, more expensive rooms, two beds, three beds, King size, Queen size etc…

While one **user A** might click on a room and wait for his position in the queue to pass, another **user B** might take another room tier and get assigned instantly. While being in the queue, the room tier of **user A** gets sold out before he got a spot, leaving him with no room and a redirect to the room selection.
**User A** might have been fine with the same room tier as **user B**, but since the feedback, that the original room tier was sold out took multiple seconds, this possibility to switch might be gone now too.

Queues are a wonderful tool to de-couple workloads while being able to maintain a feedback loop about the progress. But queue sizing is not easy and it is not reliable to get immediate response.

## The “real” Problem

This is where the interesting part began, and it already sounded over-engineered for the requester…

This booking system did not just need optimization in one specific direction. It needed a **balance of three competing goals:**

- **Consistency** — no double bookings of one room
- **Latency / Feedback** — fast responses of success / failure
- **Fairness** — equal chance to get a room (in general)

Imagine one of these Radar charts, one goal pulling on two others and the solution is to find a middle-ground.

## Rethinking the Approach

Instead of pushing the problem into a queue, I moved the logic closer to the database. *I use postgres btw.*

**The idea:** *Do selection and assignment atomically inside a transaction*

1. Start a transaction
1. Select a random available room
1. Lock it
1. Assign the User
1. Commit

Inside the transaction, I select a room with the following statement:
```sql
WITH available_rooms AS (
  SELECT r.id FROM "Room" r
  LEFT JOIN "RoomBooking" rb ON r.id = rb."roomId"
  WHERE "roomCategoryId" = ${roomCategoryId}
    AND rb."roomId" IS NULL
  ORDER BY id ASC
)

SELECT id FROM available_rooms
LIMIT 1 
OFFSET FLOOR(RANDOM() * (SELECT COUNT(*) FROM available_rooms))
FOR UPDATE SKIP LOCKED;
```

This was followed with an update statement on `Room` and the creation of a `RoomBooking` for the user inside the same transaction.

## Verdict

### Benefits

- Low latency (No queue -> the user gets immediate feedback)
- Strong consistency (Row-level locking prevents double booking)
- Reasonable fairness (Random selection by offset distributes users across available rooms)
- Simple architecture (more complex than the naive approach but no queues to maintain)

### Tradeoffs

- The database becomes the bottleneck under heavy load
- Scaling beyond a certain point requires re-thinking the model
- Still handling with “random” fairness at the room selection

But for this project with around 1000–1500 users and a few hundreds of rooms, the balance was far better than a queue.

### What I’d improve next

If we decide to keep this project up for the growing convention, I’d consider:

- a better fairness strategy (not just random)
- tier-aware allocation logic with "fallback choice"
- retry strategies with back-off
- Observability (how often do we fail and when?)
- Possible hybrid-approaches (light queuing under pressure)

## Final Thoughts

The biggest lesson here wasn’t about SQL transactions or queues. Locking-mechanisms are basics in concurrency.

It was this:

> Fixing race conditions is easy.
>
> Designing a system that feels fair and snappy is not.

And sometimes, the most “sophisticated” solution is not the best one…