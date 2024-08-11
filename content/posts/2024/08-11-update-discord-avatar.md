+++
title = 'Updating Discord avatars with auth.js'
date = 2024-08-11T14:37:28+02:00
draft = false
tags = ['nextjs', 'prisma', 'furrcard', 'discord', 'backend']
tldr = 'Since the discord avatar url changes on every change, I decided to update the user avatar in the database on each login.'
+++

Since I don't want to handle with emails and passwords on [FurrCard](https://furrcard.com), I solely rely on common oauth providers like Discord and GitHub for authentication. A popular solution for oauth authentication in nextjs is Auth.js (formerly next-auth) which supports (and somewhat encourages) persisting sessions in a database using the prisma-adapter.

This works quite well with a minimal setup basically, just referencing the Discord-Provider and Prisma-Adapter.
```ts
import prisma from "./lib/prisma";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthConfig } from "next-auth";
import Discord from "next-auth/providers/discord";
import NextAuth from "next-auth";

...

export const config = {
    adapter: PrismaAdapter(prisma),
    providers: [Discord],
    ...
    
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(config);
```

You can clearly see a mix between `next-auth` and `@auth` packages in the imports. This is due to the current transition and should be all in `@auth` in the future (hopefully). This all works very well...until the user changes his avatar.

## Missing Avatar images
At some point in time, I came across some users with broken avatar images. This is not really visible to regular users on FurrCard, only exception being the affected user themselv. Anyhow, when checking through the newcomer-list on my admin interface, I got greeted with this in the user table.

{{<figure src="https://i.imgur.com/B65reAe.png" title="Missing avatars">}}

My first thought was *mhmmm, maybe the images aren't cached or I made an ooopsie in the image fetching?* but when I looked deeper into it, I found out that the images don't exist anymore and I simply get a `404` from the Discord cdn. After checking some users in Discord directly, those simply changed their avatar in the app.

### How Discord serves user avatars
Discord has a special way of serving user avatars on their cdn, which also helps them to refresh the cache on an avatar change more easily. The URL for respective avatars includes the `user-id` and an `avatar-id`.
```
https://cdn.discordapp.com/avatars/<user-id>/<avatar-id>.<gif|png>
```
Each time a user uploads an avatar, it get's assigned a new `avatar-id` and since Discord allows animated avatars, also changes the file format if necessary.
Like I said, this is very good for forching the in-app cache to refresh, since the requested avatar url has changed. It's sadly not very good if one wants to persist user avatar urls, since the Discord cdn will delete retired avatars eventually.

In contrast, GitHub serves user avatars in a more simple manner, utilizing the `user-id`.
```
https://avatars.githubusercontent.com/u/<user-id>
```
This, while making persistence of those way easier, leads to delayed updates of the avatar in apps using cache for visible images. It...also makes it possible to browse through user avatars by just changing the `user-id` (it is a sequential number on GitHub).

{{<figure src="https://avatars.githubusercontent.com/u/7807230" title="My current avatar on GitHub. period.">}}

## Possible solution

The first (and basically only) solution that came up with my research was to [request the current avatar from the Discord-API](https://github.com/nextauthjs/next-auth/discussions/9204) via a Discord-Bot in the `session`-callback of auth.js.

A solution that works, but which I have multiple issues with:
- It requires the **usage of a Discord-Bot-Token** to request the API
- It **does not persist** the avatar in the database, which probably wasn't the scope in the solution
- It triggers an API-Request to refresh the avatar **on each session request**, which can be multiple times per page load [[source]](https://next-auth.js.org/configuration/callbacks#session-callback)

Especially the 3rd issue can be very costly for the callback execution time and load on the Discord-API. I therefore looked for callbacks that are more reasonable for my purpose.

## How I update new Discord avatars

One callback that works particularly well for my case is the `signIn`-callback, since it retrieves the `account` and `profile` as parameters.

- The `account` parameter represents the *locally* mapped user account that was found during the signIn-process, consisting of the used provider (`discord`) and the `user-id`.
- `profile` represents the data retrieved from OAuth, containing the `user-id` and current avatar url to the time of the signIn-procedure.

This is perfect. We get the current avatar url on each user login and just need to save it. I think it's a fair compromise to only update the avatar here, considering the chance of people changing their avatar multiple times with-in a short amount of time being low.

```ts
async signIn({ user, account, profile }) {
    try {
        if (account?.provider === 'discord') {
            const userAccount = await prisma.account.findUnique({
                include: { user: true },
                where: { 
                    provider_providerAccountId: {
                        provider: account.provider as string,
                        providerAccountId: account.providerAccountId as string,
                    }
                },
            });
            if (userAccount && profile?.image_url) {
                await prisma.user.update({
                    where: { id: userAccount.user.id },
                    data: {
                        image: profile?.image_url as string,
                    }
                });
            }
        }
    } catch (error) {
        console.error(error);
    }
    return true;
},
```

Since I'm using multiple provider in FurrCard, I first check which provider is used for the current account. The `profile`-objects of other providers can (and should) look differently. 
Then we have to find the unique user who tries to log in. Each Account has a unique constraint consisting (`provider_providerAccountId`) of the provider name and account id of the respected user. With the first part we try to find an account of the user who's signing in. If we found an existing account (and the profile has a set image url), we then update the user dataset with the new avatar. 

It is important to return true at the end. Otherwise the signIn-process would be stopped with an error.

### Considerations
- It is possible to set the `image` property of the user to `null` if the user deleted his Discord avatar and didn't set a new one. This would respect the users decision to remove their avatar image
- For a single-provider setup, the callback can be simplified. The `providerAccountId` is equal to the discord `user-id` and we wouldn't have to check for the current provider name.

This simple callback seemed like a quite lean solution for my problem of users missing their avatar image over time. I'll update this post with remarks if I overcome more obstacles in this topic :3