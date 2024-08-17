+++
title = 'Homelab: Setting up Caddy Reverse Proxy with SSL on NixOS'
date = 2024-08-17T17:18:35+02:00
draft = false
toc = true
tags = ['nixos', 'security', 'homelab']
+++

## What is Caddy and why do I use it
[Caddy](https://caddyserver.com/docs/) can be called a *multipurpose* webserver, coming with a large subset of modules and 
being ready for most applications out-of-the-box while keeping a simple configuration.
Some might know Caddy for being capable to automatically request Let's Encrypt certificates without the need of [certbot](https://certbot.eff.org/) etc.

I used to be a huge fan of [nginx](https://nginx.org/en/). Not [Nginx Proxy Manager](https://nginxproxymanager.com/), but pure nginx xD
I love the performance, I'm still very dependent on the [internal routing](https://nginx.org/en/docs/http/ngx_http_core_module.html#internal), and even though I'm fine with configuring nginx, it doesn't feel very intuitive sometimes.

I can say similar to [Traefik](https://doc.traefik.io/traefik/), another popular reverse-proxy software, that I use sometimes but never really got *"warm"* with.

This is where Caddy comes into play. I switched to using Caddy for a lot of my setups. If the built-in features are not enough, you can add plugins (like [DNS-01 challenge](https://letsencrypt.org/docs/challenge-types/#dns-01-challenge) with [DNS provider modules](https://caddy.community/t/how-to-use-dns-provider-modules-in-caddy-2/8148)).
For my old infrastructure, I basically built my own [Dockerfile](https://github.com/aottr/caddy-dns/blob/main/Dockerfile) that just included the dns modules for `cloudflare` and `porkbun`,
spun it up in docker-compose with my services and had this simple `Caddyfile` (Caddy configuration) for my services:

```caddy
*.ferret.otter.foo {
    # You don't need this if you host on the public Internet (e.g. with a public IP)
    tls {
        dns porkbun {
			api_key {env.PORKBUN_API_KEY}
			api_secret_key {env.PORKBUN_API_PASSWORD}
	    }
    }

    @paperless host paperless.ferret.otter.foo
    handle @paperless {
        reverse_proxy paperless:8000
    }

    @memos host memos.ferret.otter.foo
    handle @memos {
        reverse_proxy memos:5230
    }
}
```

And that's it. After setting the `PORKBUN_API_KEY` and `PORKBUN_API_PASSWORD` as environment variables, Caddy will automatically request a wildcard SSL-certificate from Let's Encrypt and serve the two services on the urls. 

Magic ✨

No need for having certbot running and integrating it with nginx, no multiple *complex* configuration files that get further modified by certbot afterward. *Of course there are some more settings possible, depending on the requirements of the served application, but it can be fairly simple.*

## Preparing Caddy for NixOS
If you clicked this article, you probably have some knowledge about [NixOS](https://nixos.org/) or are at least interested in it. I'm far from being an Expert, I honestly see myself at the early beginning of my journey with nix, but the nix-community is thankfully quite open towards people and there is a ton of info to find online, especially from the most recent years.

NixOS ships a [package for caddy](https://search.nixos.org/packages?channel=unstable&show=caddy), making the initial setup very easy. You simply enable the service and done.
```nix
{ pkgs, config, ... }:
{
  services.caddy = {
    enable = true;
    virtualHosts."localhost".extraConfig = ''
      respond "OK"
    '';
  };
}
```
This will start the caddy service and give the text response `OK` when accessing `localhost` with tools like *curl* on your local machine.

Since we want to access our home server from other devices in our local network, we need to open the firewall ports `80` and `443` for caddy. We therefore extend the module to get the following:
```nix {hl_lines=[3]}
{ pkgs, config, ... }:
{
  networking.firewall.allowedTCPPorts = [ 80 443 ];
  
  services.caddy = {
    enable = true;
    virtualHosts."aottr.local".extraConfig = ''
      respond "OK"
    '';
  };
}
```

We're now serving our first *Web service* on our nixOS server with the domain name `aottr.local`.
> If you don't know how to propagate DNS names in your local network, you can test this by editing your `/etc/hosts` 
> file of the accessing machine and add the ip address of your server to the respective domain.
> Example:
> ```text
> # /etc/hosts
> 127.0.0.1	    localhost
> ::1		        localhost
> 192.168.0.10	aottr.local
> ```
Accessing `http://aottr.local` with a browser will now show the configured `OK` response. 

## Adding the reverse proxy to a webservice

Let's say you're hosting [paperless-ngx](https://docs.paperless-ngx.com/) on your home server to archive all your documents or
you want to listen to your local music archive of music you purchased on bandcamp or beatport with [Jellyfin](https://jellyfin.org/).
These services should be accessible easily (and especially for paperless-ngx securely) via a readable url. I'll show a simple configuration using the [Jellyfin NixOS package](https://search.nixos.org/packages?channel=unstable&show=jellyfin), since this one is the easier to set up.

```nix
{ pkgs, ... }:
{
  services.jellyfin.enable = true;
  
  services.caddy = {
    virtualHosts."jellyfin.aottr.local".extraConfig = ''
      reverse_proxy http://localhost:8096
    '';
  };
}
```
This nix module starts the *Jellyfin* service and serves it locally on port `8096`. We then add add a `virtualHosts` directive for the domain, we want to make *Jellyfin* accessible on
and pointing to `http://localhost:8096`.
Entering `jellyfin.aottr.local` in the browser will us present the web interface of *Jellyfin*, given the local DNS is set up.

If you're fine with unencrypted http in your local network, you can basically stop here.
Adding the `reverse_proxy` directive to reference your local service and it works. But I hate these `Your connection is not secure` banners, that's why **I** went further.

## The sad story of NixOS, Caddy and dns challenge
I don't want to expose my services to the internet. And even if I would like to serve some, the [HTTP-01 challeng](https://letsencrypt.org/docs/challenge-types/#http-01-challenge) does not work for wildcard-certificates. This would leave me with some services having trusted certificates while others don't. The only way I know to acquire wildcard-certificates is by using the mentioned DNS-01 challenge.

The above-mentioned caddy package does not come with any *dns provider module* and being able to add one in a *clean* way is something, the NixOS-community arguing about for many years already. 

I was faced with the following options:
1. Write a package derivation that I use instead of the default package, using the `services.caddy.package` directive.
2. Building my own package using the [xcaddy](https://search.nixos.org/packages?channel=unstable&show=xcaddy) builder and exporting the result
3. Building my own package altering the [caddy](https://search.nixos.org/packages?channel=unstable&show=caddy) package and loaded *Go* modules
4. Using Cloudflare Origin CA certificates
5. Using a different reverse proxy software that makes a DNS challenge possible out of the box.

While I tried approach (1) first, following what [someone did on GitHub](https://github.com/jdheyburn/nixos-configs/blob/46eca0686b735ff74a19867c625e7ecca2d9034a/modules/caddy/custom-caddy.nix), I wasn't able to build the derivation even with `nix.settings.sandbox = false;`, disabling the sandbox mode during build. I then tried (2) and (3) but neither my current capabilities in *nix* nor the free-time required to keep the package up-to-date, let me succeed there.

After looking into (4) further, I realized that those certificates won't work properly either, since these certificates become valid by the communication with cloudflare during the attempt to access the service and the request then being proxied by cloudflare... Not really what I want for my homelab.

Frustrated after hours of research I looked into the last possible approach and checked for available packages like [traefik](https://search.nixos.org/packages?channel=unstable&show=traefik) and [nginx](https://search.nixos.org/packages?channel=unstable&show=nginx)... till I came up with an idea.

Thus it being a nice feature of Caddy being able to request certificates automatically, it's not a necessity!! This is where [ACME](https://nixos.wiki/wiki/ACME) came into play. ✨

## Requesting SSL-Certificates on NixOS
I figured out, that I could simply request the ssl certificate using the DNS-01 challenge for my domain and save these certificates on the filesystem, making them accessible to caddy.
Some people might ask now: *where is the difference to using certbot then??...* Well, maybe Caddy will have the functionality at some point, and I'll definitely switch once they have it (or I found the motivation and time to create and maintain the package).

Setting up *ACME* is as easy as setting up any other service in NixOS. Hence, I even put it together with my caddy configuration in the same module since caddy will serve these certificates, and they therefore *belong* logic-wise together. Dependency-Coupling!! oder so.

My *ACME* config using cloudflare for my Domain looks as follows:
```nix
{ pkgs, config, ... }:
{
  # ...
  security.acme = {
    acceptTerms = true;
    defaults.email = "your@email.com";

    certs."your.domain.com" = {
      group = config.services.caddy.group;

      domain = "your.domain.com";
      extraDomainNames = [ "*.your.domain.com" ];
      dnsProvider = "cloudflare";
      dnsResolver = "1.1.1.1:53";
      dnsPropagationCheck = true;
      environmentFile = "${pkgs.writeText "cloudflare-creds" ''
        CLOUDFLARE_DNS_API_TOKEN=xxxxxxxxxx
      ''}";
    };
  };
  # ...
}
```

We basically just set some parameters like the `email` that Let's Encrypt asks you during a certificate request, followed by the `certs` directive for our domain.
`group = config.services.caddy.group;` set's the access permission of the certificate to the same group as the caddy service is running under. 
*If there are multiple services accessing the same certificates, you would set assign the `acme` group to those services instead.*

Lastly the `dnsProvider` settings for the respective provider we are using, *cloudflare* in my case. Please check the [ACME NixOS Wiki article](https://nixos.wiki/wiki/ACME) or the [Documentation of the underlying software](https://go-acme.github.io/lego/dns/index.html) for further info to other providers.

To accomplish a *DNS-01 challenge*, the requesting client will set certain `TXT`-records in the DNS settings of your domain and therefore needs API-access for the DNS provider.
You'll need to [request an api token](https://dash.cloudflare.com/profile/api-tokens) with the permission `Zone.DNS` for your domain and set the token as an environment variable with the key `CLOUDFLARE_DNS_API_TOKEN`.

{{< callout emoji="⚡️" text="Never push your token to the internet! Not even if the repository is private. Access to this key can let people change all DNS entries for this domain." >}}

You should always encrypt such secrets and there are different ways on how to approach this, including:
- Keeping this blank and only changing this value on the host itself, leaving the repository as *dirty*.
- Using a client for secret en-/decryption like [agenix](https://github.com/ryantm/agenix).

The resulting ssl certificates will be placed under `/var/lib/acme/` and can be accessed by caddy.

## Securing hosted webservices with SSL
After being able to generate certificates with *ACME*, we're now ready to add those to our caddy config. To my current knowledge, this needs to be done in a per-_vHost_ config. A way around this would be having all _vHosts_ in a cascaded config, which would remove some modularity tho.

Let's take our *Jellyfin* service and extend the caddy config:
```nix {hl_lines=["9-11"]}
{ pkgs, ... }:
{
  services.jellyfin.enable = true;
  
  services.caddy = {
    virtualHosts."jellyfin.your.domain.com".extraConfig = ''
      reverse_proxy http://localhost:8096
      
      tls /var/lib/acme/your.domain.com/cert.pem /var/lib/acme/your.domain.com/key.pem {
        protocols tls1.3
      }
    '';
  };
}
```

Please remember to substitute `your.domain.com` with your actual domain... The only change we did is adding the `tls` directive to our caddy config.
The certificate includes a `cert.pem` and `key.pem` for certificate and private key. *ACME* will create a subdirectory by default for each domain certificate.
These path names are quite long, we can therefore use template strings and save the path itself in a variable. This is especially useful when grouping multiple related webservices in the same module with a lot of repetition.

```nix {hl_lines=[3,11]}
{ pkgs, ... }:
let
    certloc = "/var/lib/acme/your.domain.com";
in {
  services.jellyfin.enable = true;
  
  services.caddy = {
    virtualHosts."jellyfin.your.domain.com".extraConfig = ''
      reverse_proxy http://localhost:8096
      
      tls ${certloc}/cert.pem ${certloc}/key.pem {
        protocols tls1.3
      }
    '';
  };
}
```

You can define this variable in your config and load it as parameter into the module alternatively. But that's basically it.
As mentioned, some services might require a more sophisticated reverse-proxy configuration, here I can only direct to the [documentation of caddy](https://caddyserver.com/docs/quick-starts/reverse-proxy).
I'm currently running 8 services with this reverse proxy config and didn't have any issues yet.'

That's it ! We got our services deployed with a human-readable name and SSL encryption. 🎉

Thanks for reading !!

## Appendix
### Encrypting secrets with agenix
The article is already long and I will soon(tm) write a short tutorial on how to set up _agenix_, [their documentation](https://github.com/ryantm/agenix?tab=readme-ov-file#installation) is also very helpful tho.

When _agenix_ is set up, we just add another secret with the api token, let's call it `caddy.age` or `cloudflare.age` and the following content:
```text
CLOUDFLARE_DNS_API_TOKEN=xxxxxxxxxx
```

We then create a reference to the location of the secret and use this reference in the *ACME* configuration.
I'm using Flake files in a git repository, so my path is relative from the nix module to the file location.

```nix {hl_lines=[5,19]}
{ pkgs, config, ... }:
{
  # ...
  
  age.secrets.cloudflare.file = ../../secrets/cloudflare.age;
  
  security.acme = {
    acceptTerms = true;
    defaults.email = "your@email.com";

    certs."your.domain.com" = {
      group = config.services.caddy.group;

      domain = "your.domain.com";
      extraDomainNames = [ "*.your.domain.com" ];
      dnsProvider = "cloudflare";
      dnsResolver = "1.1.1.1:53";
      dnsPropagationCheck = true;
      environmentFile = config.age.secrets.cloudflare.path;
    };
  };
  # ...
}
```

### My Nix(OS) Repository
My Nix configuration is online on *codeberg.org* and consists of *NixOS* and *Home-Manager* configurations (since my Framework Laptop is still running Linux).
Those are far from advanced and I still have to learn soooo much, that's why I'm taking you with me on this journey :3

If you're interested or just want to check out the given examples, it's [otterden on codeberg.org](https://codeberg.org/aottr/otterden).