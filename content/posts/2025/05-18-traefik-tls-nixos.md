+++
title = 'Homelab: Setting up Traefik Reverse Proxy with SSL on NixOS'
date = 2025-05-18T17:18:35+02:00
draft = false
toc = true
tags = ['nixos', 'security', 'homelab']
description = 'Complete guide to setting up Traefik reverse proxy with SSL certificates on NixOS. Learn how to use ACME with DNS-01 challenge for air-gapped certificates, configure services, and secure your homelab services with TLS encryption.'
+++

Remember how [I mentioned](/posts/2024/08-17-caddy-tls-nixos/), that I never really got *"warm"* with Traefik? Well, I'm still not, but at some point in time I fell for my auto-renewal not working correctly and gave it another shot.

## What is Traefik and why do I use it

*Sounds familiar yet?* Sorry... [Traefik](https://doc.traefik.io/traefik/) is a modern reverse proxy and load balancer that makes it easy to securely access your services via a domain name. It's written in Go (like Caddy) and was designed to be relatively easy to configure for container applications.

It shares many similar features with Caddy, like the ability to request certificates automatically. The learning curve is (*in my opinion*) slightly steeper than Caddy, but the possibilities for a seemless integration in NixOS (or any containerized environment) are quite nice.

Don't get me wrong, I'm still using Caddy for environments where the simplicity overshadows the features that I don't use anyway. But in the Homelab space, where we often use [DNS-01 challenges](https://letsencrypt.org/docs/challenge-types/#dns-01-challenge) for certificates and Docker stacks for services since we don't want to expose them to the internet, Traefik is a great fit.

Why am I mentioning Docker in an article about NixOS? Well, Traefik is often mentioned in the context of Docker and Kubernetes, but in the end it's just a powerful reverse proxy. Not as powerful as nginx in terms of edge-case features, but that's another story...

The NixOS integration of Traefik is actually great, better than I had it in my memory and definitely better than Caddy's at the time of writing the other article.

## Setting up Traefik on NixOS

My starting point was the [Traefik Wiki entry](https://wiki.nixos.org/wiki/Traefik) in the official NixOS wiki. It covers the basics for setting up Traefik with [HTTP-01 challenge](https://letsencrypt.org/docs/challenge-types/#http-01-challenge).

We're interested in the DNS challenge tho, or at least I was. The base setup is always the same, we enable the service and configure it. (In my case as a flake module)

```nix
{ pkgs, config, ... }:
{
  services.traefik = {
    enable = true;

    staticConfigOptions = {
      entryPoints = {
        web = {
          address = ":80";
          asDefault = true;
          http.redirections.entrypoint = {
            to = "websecure";
            scheme = "https";
          };
        };

        websecure = {
          address = ":443";
          asDefault = true;
          http.tls.certResolver = "letsencrypt";
        };
      };

      # ...
    };
  };
}
```

The configuration of Traefik is split into two parts, the static configuration `staticConfigOptions` and the dynamic configuration `dynamicConfigOptions`. For now we're only interested in the static configuration and setting up the entrypoints.

Those configuration types have recently been renamed to `startup` and `routing` configuration, which makes a lot more sense. 

{{< callout emoji="💡" text="Don't forget to configure the firewall to allow traffic to the Traefik ports (80 and 443)!" >}}

If not done so already in your NixOS configuration, you should open the firewall ports `80` and `443` for Traefik.
```nix
{ pkgs, config, ... }:
{
  networking.firewall.allowedTCPPorts = [ 80 443 ];
}
```

### The static (startup) configuration

The startup configuration is basically defining the base of Traefik like the entrypoints (ports Traefik will listen on) certificate resolvers, providers and other basic settings. [Providers](https://doc.traefik.io/traefik/reference/install-configuration/providers/overview/) are basically an interface for traefik to retrieve routing information from other sources like Docker, Kubernetes, etc. Since we want our routing to be deterministic!!, we're going straight to the definition of the next point: [Certificates Resolvers](https://doc.traefik.io/traefik/reference/install-configuration/tls/certificate-resolvers/overview/).

### Setting up a certificate resolver for `DNS-01` challenges

**Hint:** Please refer to my [Appendix about Encrypting secrets with agenix](/posts/2024/08-17-caddy-tls-nixos/#appendix-encrypting-secrets-with-agenix) for more information on how to encrypt secrets with agenix, as I don't want to encourage anyone to write plain-text passwords in their configuration.

The config block for the certificate resolver is nested inside the `staticConfigOptions` block. As you might have seen in the example above, I called my resolver `letsencrypt`.

```nix {hl_lines=["8-12"]}
{ pkgs, config, ... }:
{
  ...
  services.traefik = {
    ...
    staticConfigOptions = {
      ...
      certificatesResolvers.letsencrypt.acme = {
        email = "your-mail@example.com";
        storage = "${config.services.traefik.dataDir}/acme.json";
        dnschallenge.provider = "cloudflare";
      };
    };
  };
  ...
}
```
As usual, we need to give letsencrypt our email address. Additionally is the Traefik service asking for a storage path for the `ACME` account and certificate information. The `dnschallenge.provider` is the provider that Traefik will use to get the `DNS-01` challenge information. This can be any provider that Traefik supports, but I'm using Cloudflare for my domain. Traefik is using the [lego](https://go-acme.github.io/lego/) library to handle challenges, they [support many different providers](https://go-acme.github.io/lego/dns/index.html) out of the box and even allow you to [write your own](https://go-acme.github.io/lego/usage/library/writing-a-challenge-solver/). (If you're into this kind of stuff)

In order to use the [DNS-01 challenge with cloudflare](https://go-acme.github.io/lego/dns/cloudflare/index.html#credentials), we need to set up a [cloudflare API token](https://dash.cloudflare.com/profile/api-tokens) with the permission `Zone.DNS` for our domain and set the token as an environment variable with the key `CLOUDFLARE_API_TOKEN`.

{{< callout emoji="⚡️" text="Never push your token to the internet! Not even if the repository is private. Access to this key can let people change all DNS entries for this domain." >}}

To make the token available to the traefik service, my method of choice is to use create an environment file with [agenix](https://github.com/ryantm/agenix) and assign it to service.

After using agenix to encrypt a file in the format:
```text
CLOUDFLARE_API_TOKEN=xxxxxxxxxx
```
We can "import" the secret into our nix configuration and reference it as `environmentFile` in the static configuration.

```nix {hl_lines=[3,9]}
{ pkgs, config, ... }:
{
  age.secrets."cloudflare-traefik.env".file = ../../secrets/common/cloudflare-traefik.env.age;
  ...
  services.traefik = {
    ...
    staticConfigOptions = {
      ...
      environmentFile = [config.age.secrets."cloudflare-traefik.env".path];
    };
  };
}
```

Make sure to give the correct path to the secret file in your configuration / file structure! 
*(I'm speaking from experience...)*

Now your static configuration is set up. An example of my static configuration can be found [here](https://codeberg.org/aottr/otterden/src/commit/d854550ab58280d23120243c07df1867e89e85d3/modules/nixos/server/traefik.nix). There are of course [more settings](https://search.nixos.org/options?channel=unstable&show=services.traefik.staticConfigOptions&query=traefik) you can configure, but for now we're good to go. Let's continue with the dynamic config and our first service!


## Adding a service to Traefik

To add a new NixOS service (or container, etc.) to our new reverse proxy, we just need to extend the `dynamicConfigOptions` of our Traefik service, preferably where we also define the service that we want to expose.

{{< callout emoji="⚡️" text="Configurations in NixOS will be merged with already existing configurations in the order they are defined / imported. We can therefore extend the config by creating new service configurations in other modules." >}}

Let's take a service I want to expose via Traefik, my *paperless-ngx* service.
```nix {hl_lines=["8-12"]}
{ config, ... }:
{
  ...
  services.paperless = {
    enable = true;
    ...
  };
}
```

Now we can extend the dynamic config of our Traefik service to add the service to the routing.
```nix {hl_lines=["4-8"]}
{ config, ... }:
{
  ...
  services.traefik.dynamicConfigOptions.http = {
    services.paperless.loadBalancer.servers = [
      {url = "http://localhost:${toString config.services.paperless.port}";}
    ];
  };
}
```

We gonna start by creating a new service for *paperless* by writing a new `dynamicConfigOptions.http` block inside our Traefik service. We don't need much config in this example, we just create a new Traefik service `paperless` and point it to the internal address of the paperless.

We don't even care what port *paperless* is running on, since we can use it from the NixOS service configuration directly. If you assigned a custom port to *paperless* in your NixOS config, this will also be respected.

Next step is to create a new router for our new service.
```nix {hl_lines=["5-10"]}
{ config, ... }:
{
  ...
  services.traefik.dynamicConfigOptions.http = {
    routers.paperless = {
      entryPoints = ["websecure"];
      service = "paperless";
      rule = "Host(`documents.your.domain.com`)";
      tls.certResolver = "letsencrypt";
    };
    services.paperless.loadBalancer.servers = [
      {url = "http://localhost:${toString config.services.paperless.port}";}
    ];
  };
}
```

After rebuilding your NixOS configuration, you should be able to access *paperless* at `https://documents.your.domain.com`. Easy, wasn't it?

You can also combine multiple services and routers in one block, like I did in [my config for Home Assistant and Zigbee2MQTT](https://codeberg.org/aottr/otterden/src/commit/d854550ab58280d23120243c07df1867e89e85d3/modules/nixos/server/home-assistant.nix), where Home Assistant is an `oci-container` using podman and Zigbee2MQTT a nixos service.

Here another full example of an `uptime-kuma` configuration:

```nix {hl_lines=["12-23"]}
{ pkgs, config, lib, ... }:
{
  services.uptime-kuma = {
    enable = true;
    settings = {
      PORT = "48080";
      UPTIME_KUMA_DB_TYPE = "sqlite";
    };
  };

  services.traefik.dynamicConfigOptions = lib.mkIf config.services.traefik.enable {
    http = {
      routers.uptime-kuma = {
        rule = "Host(`uptime.your.domain.com`)";
        service = "uptime-kuma";
        tls.certResolver = "letsencrypt";
      };
      services.uptime-kuma = {
        loadBalancer.servers = [{
          url = "http://localhost:48080";
        }];
      };
    };
  };

  networking.firewall.allowedTCPPorts = lib.mkIf (!config.services.traefik.enable) [ 48080 ];
}
```
Here I even allow the port in the firewall and don't extend the Traefik config if Traefik is not enabled. (Just as a small example what you can do).

## Accessing the Traefik dashboard

One thing that most people prefer on Traefik, compared to other reverse proxies like nginx or Caddy, is the built-in dashboard. Although this can be enabled in the static config with an unencrypted connection on port `8080`, I'd not recommend it even in a homelab environment.

Reason for that is, that the dashboard port **can not be changed** to another port, unless you create a router for the dashboard...which in my opinion negates the purpose of using the insecure option in the first place. I might want to expose other services on that port, not my reverse proxy dashboard...

Thankfully, creating a router is quite easy in NixOS. For this we create a `dynamicConfigOptions` block inside our traefik service and define a router for the dashboard.
```nix {hl_lines=["6-11"]}
{ pkgs, config, ... }:
{
  ...
  services.traefik = {
    ...
    dynamicConfigOptions.http.routers.dashboard = {
      entryPoints = [ "websecure" ];
      rule = "Host(`traefik.your.domain.com`)";
      service = "api@internal";
      tls.certResolver = "letsencrypt";
    };
  };
  ...
}
```

The service will now request a certificate for the dashboard domain `traefik.your.domain.com` via *letsencrypt* and the dashboard will be available.

I hope this little guide helped you to get started with Traefik on NixOS. I didn't plan to "migrate" from Caddy initially, but I don't regret it due to the cleaner config interface and automatic certificate renewal that didn't fail me yet. ^^"

Feel free to leave a comment below and check out my other nix-configs on [Codeberg](https://codeberg.org/aottr/otterden/src/branch/v2).

### Troubleshooting

#### Traefik has issues with the certificate resolver

If you have issues with internal dns resolution or the propagation of the challenge, it's worth extending the `dnsChallenge` a bit.

```nix {hl_lines=["11-17"]}
{ pkgs, config, ... }:
{
  ...
  services.traefik = {
    ...
    staticConfigOptions = {
      ...
      certificatesResolvers.letsencrypt.acme = {
        email = "your-mail@example.com";
        storage = "${config.services.traefik.dataDir}/acme.json";
        dnsChallenge = {
          provider = "cloudflare";
          resolvers = [ "1.1.1.1:53" "9.9.9.9:53" ];
          propagation = {
            delayBeforeChecks = "10s";
          };
        };
      };
    };
  };
  ...
}
```

#### Changing the log level of Traefik

If you're still encountering issues with Traefik and don't find anything in the logs either, you can change the log level to `DEBUG` to get more information.

```nix {hl_lines=["8-12"]}
{ pkgs, config, ... }:
{
  ...
  services.traefik = {
    ...
    staticConfigOptions = {
      ...
      log = {
        level = "DEBUG";
        filePath = "${config.services.traefik.dataDir}/traefik.log";
        format = "json";
      };
      ...
    };
  };
  ...
}
```

This will create a log file in the data directory of Traefik (usually: `/var/lib/traefik/`) and log all messages `>= DEBUG` to it.