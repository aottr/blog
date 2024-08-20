+++
title = 'Stay up-to-date with your RSS feeds anywhere with miniflux'
date = 2024-08-19T23:07:31+02:00
draft = false
tags = ['nixos', 'homelab']
toc = true
tldr = 'Setting up miniflux is fairly simple, custom css makes the reader very appealing and the many integrations help syncing your progress with different devices.'
images = ['https://i.imgur.com/KPAQPxo.png']
+++

I'm reading articles and news daily from many different sources. I used to only read them on my phone before sleeping but I also started browsing blogs on my laptop at some point.
During my regular flights to the US, I also see myself reading articles in the plane on my tablet. This behavior accumulated quite the amount of different devices where I read articles and rss feeds. 

But what happens if you, let's say browse different websites and blogs daily, you bookmark them. In best case they have an *RSS*-, *Atom*- or *JSON*-based feed that you can subscribe to. Then you install apps on your devices or browse the website on each device....and at some point, you're like: *did I read this Article already? Did I bookmark it because I liked it or because I didn't read it yet?*

Maybe you're more organized than me (and that's okay!), but that's how I felt till some friends recommended me [miniflux](https://github.com/miniflux/v2).
This little piece of software is not only a feed reader, it also comes with a [long list of integrations](https://miniflux.app/docs/index.html) to synchronize subscribed feeds and the state of your progress (read/unread) with the majority of possible clients.

{{<figure src="https://i.imgur.com/KPAQPxo.png" title="Start page of miniflux with a list of unread articles">}}

I'm using Unread on my phone and tablet, but they have an extensive [list of 3rd party applications](https://miniflux.app/docs/apps.html) that can be used with the integrations. And the best thing is, you don't even have to install additional things to use them, just activate the endpoint and boom. ✨

{{< callout emoji="⚡️" text="Having many integrations bundled with no possibility to remove them has it's drawback, but the binary is less than ~20MiB large, so I'll let that slip and keep it as an advantage." >}}

Enough advertisement, just [check it out](https://miniflux.app/)! :3

## Installing miniflux on NixOS
Now that I tasered this smol but nifty reader, you might want to install it. I took big inspiration on my friend [Scrumplex' repository](https://codeberg.org/Scrumplex/flake), since he was also the person who recommended it to me. The integration in nixos is very simple, especially if you followed my previous tutorials to this point (regarding the reverse proxy).

```nix
{config, ...}:
{
  age.secrets.miniflux-creds.file = ../../secrets/miniflux-creds.age;

  services.miniflux = {
    enable = true;
    adminCredentialsFile = config.age.secrets.miniflux-creds.path;
    config = {
      LISTEN_ADDR = "localhost:18069";
    };
  };
}
```

This will install the `miniflux` service, together with `postgresql` database, on your server. The web-app will be available on `http://localhost:18069` and authentication will be via username and password. There is a `DISABLE_LOCAL_AUTH` [environment variable](https://miniflux.app/docs/configuration.html#disable-local-auth), I never tested it though.
{{< callout emoji="⚡️" text="If you already have a postgres service running on your server, it will just create the database and ensure the user access." >}}

When activating authentication (either oauth or local auth), you probably want to save those secrets where others can't read it. I used my old friend `agenix` again for this, which encrypts the file with an *SSH-key* and *AGE*.
The encrypted file needs (at minimum) the following:

```env
ADMIN_USERNAME=
ADMIN_PASSWORD=
```
With a minimum password length of 6 characters. You can check out [all possible configuration variables](https://miniflux.app/docs/configuration.html), but those describe the bare minimum for local auth.

## Activate reverse proxy for miniflux
Now that we have the app up and running, let's add it to our reverse proxy so we can access it from different devices, encrypted.

```nix {hl_lines=["3-4", 13, "18-26"]}
{config, ...}:
let
    certloc = "/var/lib/acme/your.domain.com";
    fqdn = "miniflux.your.domain.com";
in {

  age.secrets.miniflux-creds.file = ../../secrets/miniflux-creds.age;

  services.miniflux = {
    enable = true;
    adminCredentialsFile = config.age.secrets.miniflux-creds.path;
    config = {
      BASE_URL = "https://${fqdn}";
      LISTEN_ADDR = "localhost:18069";
    };
  };

  services.caddy = {
    virtualHosts."${fqdn}".extraConfig = ''
      reverse_proxy http://${config.services.miniflux.config.LISTEN_ADDR}

      tls ${certloc}/cert.pem ${certloc}/key.pem {
        protocols tls1.3
      }
    '';
  };
}
```

Following my tutorial about [setting up caddy as reverse proxy](/posts/2024/08/homelab-setting-up-caddy-reverse-proxy-with-ssl-on-nixos/), we define two variables `certloc`, containing the location of our ssl-certificate, and `fqdn`, our domain name for *miniflux*.

We should then add yet another environment variable `BASE_URL` containing the domain with protocol. Lastly the *Caddy* configuration for the vHost. The internal address of the service can be conveniently read out from `config.services.miniflux.config.LISTEN_ADDR`, minimizing potential error on initial installation and later re-configuration. ✨

Let's rebuild the system and access miniflux on `miniflux.your.domain.com` (or your configured url) by entering the set admin credentials. 

You might say now...*this doesn't look like in your screenshot above!?*

## Customizing miniflux and adding integrations
Miniflux is extensible (**with limits**). Some tools are using the provided APIs to extend the functionality of miniflux and, aside from the built-in themes, there is also support for *Custom CSS*.

While there is a [curated list](https://github.com/MaybeThisIsRu/awesome-miniflux) of miniflux extensions, it doesn't seem to be updated very frequently. I personally love the [Catppuccin themes](https://github.com/catppuccin) and there is thankfully also a [theme for miniflux](https://github.com/catppuccin/miniflux).

For these, you basically just go to **Settings** -> **Application Settings** -> **Custom CSS** and paste the css.

Compatibility with other RSS-reader apps can be accomplished by activating integrations in the **Integrations** settings. I personally only use the *Fever* integration so far. 
When opening my app *Unread*, I just need to add a new *Account*, entering the url `https://miniflux.your.domain.com/fever/` and the username/password I set in the integration. Done ~

{{<figure src="https://i.imgur.com/LEnx2Ii.png" title="Settings -> Integrations, with configured Fever integration">}}

This post was again quite short and not very elaborated, I hope you still enjoyed reading it though. And I sincerely hope that at least one person didn't know about such tools yet and got blown away by this article xD. I honestly manually synched my subscribed feeds from one device to another for years...


Thanks for reading !