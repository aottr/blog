+++
title = 'The FurrCard EditorV2 is finally here'
date = 2024-08-12T00:09:43+02:00
draft = false
tags = ['furrcard']
+++

Refactoring some *old* code can be refreshing. Seriously ! xD (at least for me). So it seemed very close to my mind to take a look at the card editor of [*FurrCard*](https://furrcard.com) again after finishing the majority of features that I implemented. Why tho? Because I felt the code bloated with lots of property-drilling and tons of functionality at the same place.

Don't get me wrong, having a *one-page-serves-all* solution can be a good experience. No need to switch between pages to set up a card. There are a few main issues that I saw here tho.
- It got very difficult to troubleshoot and update individual parts
- Constant lazy-loading of other parts that can be displayed on a card lead to a lot of overhead with complex states
- Some parts are not really dependent of each other, like having a fursona on multiple cards
- ***Multiple cards ?*** Right. This wasn't possible at all with the old editor since it was served on the root `/edit`
- The freshly developed [settings-page](https://furrcard.com/settings) with a lot of new features and options was basically invisible

## How it began

I then started laying out a new design, extending the new settings-section. 

Idea was to utilize the sidebar for a card selection, making it possible to potentially have more than one card per user. Why would one do that? Let's say someone has multiple projects under different names. I for example sometimes publish drawings under the name *Kayoccino*, something I don't want to keep separate from my main link-page and social accounts.

I then thought about abstracting core responsibilities into individual states for *cards*, *pages* (per card) and *fursonas*. These responsibilities come from their underlying relationships.
- a user can have one or more cards
- a user can have one or more fursonas
- a card can have one or more pages
- a fursona can be featured on one or more cards

The focused reader might ask themselv now...But! Why are pages separated then? They are clearly dependent on a card and therefore belong inside of the card editor.
**Yes**, that's true. And I'll explain further what I did.

## Live-Previews for all parts of a card
For all my beta-testers and early users of FurrCard, at least the ones who looked into the page-feature, you might remember that although you can use MarkDown in page content, it isn't really intuitive since you can not see the appearance of the page before saving and publishing it. This was a huge UX-mess in my understanding. MarkDown is easy for me, very easy. I wrote big parts of my thesis and multiple university papers in MarkDown, solely relying on the syntax highlighting before migrating the texts to LaTeX. But I can not assume this level of understanding from others, especially regular users who use FurrCard to set up their online presence in a world where WYSIWYG editors exist for more than a decade.

I therefore wrote the requirement of having a live-preview for pages, similar to the one that users had for their card in the old editor. To establish this without making
complex switches in the *emulated* browser window, I created a new area for page management, visibly dependent per card via a sub-menu in the sidebar.

{{<figure src="https://i.imgur.com/5zBXfVK.png" title="Pages button below the Card Editor">}}

After clicking this button, you get greeted with a new area, listing all your pages and letting you create new ones.

{{<figure src="https://i.imgur.com/77PFtnR.pngg" title="Page Editor with live preview on the right">}}

The new page editor allows you to see the current state of the page while you are typing. Allowing you to see how different headlines work, if the banner aspect ratio is good and so on. I honestly hope, that this makes the pages more visible in general. I thought it would be a cool idea but looking in the admin panel...nobody is using it xD so be the first and make this ott happy ! xp

I currently only support using the same theme for all parts of a cards appearance. This will be interesting when I implement the new fursona editor. I have a lot of little secrets in mind for that one so it will take a little more time. (hint: Image Galleries !!)

I tried to keep the live-preview of the cards as they were, mainly overhauling the general structure and reactivity of the editor.

## Reactivity of the new Card Editor

Having pages outside of the card editor also comes with drawbacks...of course. So for example of how to add a page to a card after creation. The old way to add a page was as followed:
1. Create a page
2. Click the tiny `+` button to add it at the end of the link list
3. Move the link where you want it
4. Probably renaming the page and assigning an icon

Yes, it was all on the same page, but there was some *magic* involved, that just let it feel unbaked for me. 
After creating your pages, while you could already see how they look before adding, publishing and creating the link like in the old editor, you just open the card editor. This can also be done in a new browser tab...

A page is in theory also just another link that you add to the page. Adding a link opens a new menu that lets you choose between an external link, a page or fursona.

{{<figure src="https://i.imgur.com/oDwpshH.png" title="Add Link menu with selection">}}

When selecting *Page*, we can now choose which page we want to create a link for, assigning an icon if wanted and boom. Your new page is now properly linked. The selection for the pages and fursonas refreshes periodically in the background, so whenever you add new pages, they will appear in there.

Once we're happy with how the card looks, we need to publish the current state of the card to the internet (since all changes that are made are local for cards).
If there were any changes to revert since the last save, the only solution was to reload the browser tab...till now!

Instead of the old ***Publish changes** button on the top-right, there are now two buttons for reset and save. Both become active once there were changes detected. And if changes were reverted manually, the new system also detects this and disables the buttons again, ensuring you that everything is back to how it was.

## Future state of the Legacy Editor and EditorV2

Like mentioned, fursonas still don't have their own editor yet and it will take a few more time for it to be done. (Especially since I'm currently fully moving to France, switching jobs, upcoming conventions where I volunteer etc.) Therefore, and since both new editors in EditorV2 are currently in public beta, the old editor (now Legacy Editor) will remain for a while. 

I will gather feedback from users, update the [Issue Tracker](https://github.com/users/aottr/projects/2) and keep developing the new features for fursonas and cards. All new features for cards and pages will be added to the new Editor. I understand that it can be annoying to switch between all these new editors for the next time but please be patient, give me input on what can be improved and I will do my best <3

I especially want to thank my supporters at this point. What started out as a little side project to renew my personal link-page lead to something I couldn't have imagined before. Please know that you can always reach out to me and throw your ideas at me. And I hope you are happy with the little in-depth WIPs, early features and higher quotas I can give you for the support.


That being said, thank you for reading. Let me know in the comments if this was too technical or not technical enough. I'm trying to keep these updates more *user-friendly* than my regular content.

## You want to know more about FurrCard?
Check out the service yourself on [furrcard.com](https://furrcard.com) and/or browse [my articles about furrcard](/tags/furrcard/) and the process writing it.