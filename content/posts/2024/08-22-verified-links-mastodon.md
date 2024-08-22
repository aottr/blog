+++
title = 'Have your links verified on Mastodon'
date = 2024-08-22T02:26:05+02:00
draft = false
tags = ['security', 'furrcard']
images = ['https://i.imgur.com/50nTp6m.png']
+++

Some of you might use *Mastodon*, have an account there or at least heard of it. One feature of a mastodon profile is the *Profile metadata*, which lets you add all kinds of text and links to your profile.

One feature that some might not be aware of, at least I didn't see it on a lot of profiles, is, that you can have these links to your other social media profiles and websites shown as *verified*. Mastodon themselves describe this verification as follows:

> **Verifying your identity on Mastodon is for everyone.** [...] All you need is a personal website that people recognize you by. When you link to this website from your profile, we will check that the website links back to your profile and show a visual indicator on it.

This *visual indicator* is a very noticable green box surrounding the link with a checkmark, as shown below.

{{<figure src="https://i.imgur.com/50nTp6m.png" title="My mastodon account with verified links">}}

The question is now: *How can I add this to my profile?? How does it work?* And the answer is quite simple. All it needs is an html reference to your mastodon profile, containing the profile-url as `href` and `rel="me"`. The best ways, according to the mastodon documentation, are the `link` and `a` tag, while both must be static / visible on first render without javascript.

```html
<link href="https://furry.engineer/@alex" rel="me" />
```

This would create an, for the regular user invisible, reference to your mastodon profile. (after you changed the url to your own mastodon ofc...)
Another, and more staight-forward way, would be just adding the `rel="me"` attribute to existing links to your mastodon account on your personal website or blog. Again, it's important that you are able to edit the html-tag of the link, not just the url.

```html
<a href="https://furry.engineer/@alex" rel="me">Mastodon</a>
```
You can further check which pages are triggering the verification on your mastodon account by accessing `/settings/verification` (**Edit Profile**->**Verfification**).

This covers websites (or identites), where you have actual html access to your profile page, but how does it look with other services you're using?

## Adding verified links for 3rd-party services

So far, I don't know many services where you can add the verification besides websites you manage yourself, but there are a few:

- [keyoxide](https://keyoxide.org/) by [adding the proof](https://docs.keyoxide.org/service-providers/mastodon/) to your profile
- [Github](https://github.com/) by creating a profile readme
- [FurrCard](https://furrcard.com) by adding the link and selecting the mastodon icon.

### Creating a github readme
To verify your github account, you create a new public repository with the same name as your github username.
My github username is `aottr`, which means the repo is also called `aottr`. [A reference](https://github.com/aottr/aottr/).

Once the repository is created and initialized, you create or edit the `README.md` file and add the html reference wherever you want. (Yes, you can add html in markdown on github)

{{<figure src="https://i.imgur.com/OG994pU.png" title="Open the readme file in an editor and add the link">}}

Check out their docs article about how to [manage your profile README](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme) for more information.

### Creating a link on FurrCard

All links created on the FurrCard card editor with the *Mastodon*-icon have the `rel="me"` attribute automatically. This means you just:
1. Log into your FurrCard account
2. Open the Card Editor
3. Add a new *External Link* on ***Add Link*** or ***Add Social***
4. Select the mastodon icon on the left
5. Enter the link to your mastodon account

And that's it. Save your card on the top-right and the backend will do the rest.

{{<figure src="https://i.imgur.com/FbgcsYk.png" title="Add Link-Dialog with the mastodon icon selected">}}

This little addition came in version `0.6.5` and was very fast and easy to do. Here the actuall `diff` of the update. xD
```tsx
rel={link.icon === 'Mastodon' && 'me' || undefined}
```
I therefore wonder why not many other provider add this, especially if they have predefined input fields for mastodon accounts.

Anyway..I hope you liked this little excourse. Let me know in the comments if you know other services where this works!
