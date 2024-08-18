+++
title = 'Homelab: Using the same local domain to access my services via Tailscale VPN'
date = 2024-08-18T15:33:18+02:00
draft = false
toc = true
tags = ['nixos', 'security', 'homelab']

tldr = 'While round robin DNS works, split DNS feels more sophisticated and is easy to set up.'
+++

Yesterday, I showed how I set up my home server with caddy to retrieve SSL certificates and serve my self-hosted 
services like paperless-ngx and Jellyfin on human-readable domain names with SSL encryption.

Let's say you're somewhere outside with friends or generally not in your home network, and you want to access some of
your services at home to scan a receipt for paperless or listen to your music library.

Exposing those services to the internet is no option to me personally, even though the services I'm using have a built-in authentication,
I simply prefer to keep the number of access-points to my local network small. It would also go against the DNS entries we
set up, since those point towards the private IP addresses of the home network.

## Setting up Tailscale on our devices
I don't want to elaborate this topic too much, Tailscale themselves have a great [documentation on how to use their service](https://tailscale.com/kb/1017/install),
and it is a single shell-command or the download of the app, followed by authenticating and approving the device.

On NixOs, we obviously use the [tailscale package](https://search.nixos.org/packages?channel=unstable&show=tailscale) and enable the service in our configuration:
```nix
{ pkgs, config, ...}:
{
  services.tailscale.enable = true;
}
```
After the next rebuild, we just start the service **once** with `sudo tailscale up` and authenticate, they even have it documented on their [download page](https://tailscale.com/download/linux/nixos).

We basically want to add all clients that are supposed to connect to our homelab in the same wireguard mesh (called tailnet) with tailscale.
Once we're done, we navigate to the [Admin console](https://login.tailscale.com/admin/machines) and check if all our devices are present and have the *Last Seen* status of `Connected`. Tailscale also automatically enables a *Key expiry* with a maximum validity of 180days, I personally have this disabled for my homelab since it would ask me to re-authenticate those machines. *You can disable it in the 'Machine settings' by selecting 'Disable key expiry'.* It is generally advised to keep it activated on *less trusted* machines, like VPS. Bear in mind though, that you **won't be able to connect** to _expired_ machines through the _tailnet_.

We now have a vpn between our *possible* remote devices and the homelab in the subnet `100.0.0.0/8`, and can access our services via the port (e.g. `100.24.1.24:8096` for jellyfin), if the `openPort` directive is enabled for the service. What we **can not** do so far, is using our defined fqdn to access the service, since the DNS entry points at the private address in a different subnet (our local network).

## Ways of accessing our services via domain
There are several ways of making it possible to use our domain names for accessing the services, each comes with their own pros and cons. Those include:
- Propagating the local network to the _tailnet_
- Round-Robin DNS with a second dns entry per domain
- Split DNS with a local DNS resolver

Since I have multiple external servers in my _tailnet_, I don't feel like propagating my local addresses, even with several **ACL**-rules enabled. 

### Round robin DNS
The configuration of a [round-robin DNS](https://developers.cloudflare.com/dns/manage-dns-records/how-to/round-robin-dns/) is by far the easiest way. The only step we would have to do is adding the ip address of our servers `tailscale0` interface (e.g. `100.128.23.128`) as `A` record to our domain. This way, we have one domain name pointing at two different ip addresses and the dns resolver will respond with one or the other.

**Considerations:**
- Round-robin is very _primitive_ and the resolver doesn't know if we are accessing from our vpn or the local network.
- This results in the possibility of some requests receiving the *wrong* answer, elevated by DNS cache.
- While [tailscale states that this is generally safe](https://tailscale.com/kb/1019/subnets#route-dns-lookups-to-an-internal-dns-server) to do, this approach plays against the general idea of round-robin since one of the ip addresses is always not reachable.

### Split DNS (Split-horizon)
Tailscale allows to configure [restricted nameservers](https://tailscale.com/kb/1054/dns#restricted-nameservers) or Split-DNS in the [Admin console](https://login.tailscale.com/admin/dns) to define private nameservers, that only react to specified domain suffixes, while all other requests are answered by public nameservers.

**Considerations:**
- Split-DNS requires the setup of a dns resolver running inside the _tailnet_.
- If we want to host services like [Adguard Home](https://adguard.com/en/adguard-home/overview.html) or [Pi-Hole](https://pi-hole.net/), we need to limit the interface of the dns resolver.

With all considerations in mind, this is still the most sophisticated way of handling this. Requests coming from either the vpn or local network receive the right ip address for the requested domain name.

## Configuring the dns resolver with unbound
[Unbound](https://www.nlnetlabs.nl/projects/unbound/about/) is a fast and lightweight dns resolver and relatively easy to set up for this purpose.

Let's start by writing a new module in nix, enabling the service.
```nix
{ pkgs, config, ... }:
{
  services.unbound = {
    enable = true;
    resolveLocalQueries = false;
  };
}
```
 We enable the service and set `resolveLocalQueries` to `false`, otherwise unbound would also try to answer local requests, making it impossible to access the internet. Now we add the settings of the unbound server.
 
```nix {hl_lines=["7-12"]}
{ pkgs, config, ... }:
{
  services.unbound = {
    enable = true;
    resolveLocalQueries = false;
    
    settings = {
      server = {
        interface = [ "${config.services.tailscale.interfaceName}" ];
        access-control = [ "100.0.0.0/8 allow" ];
      };
    };
  };
}
```
We configure the listening interface of our unbound service to `config.services.tailscale.interfaceName`, which reads out the interface name that is used (or better defined) by the tailscale service. The `access-control` directive limits the requests to the subnet of our _tailnet_.

This being done, we now need to add the `local-zone` for the server that's associated with the domain name and hosting our services.
```nix {hl_lines=["12-14"]}
{ pkgs, config, ... }:
{
  services.unbound = {
    enable = true;
    resolveLocalQueries = false;
    
    settings = {
      server = {
        interface = [ "${config.services.tailscale.interfaceName}" ];
        access-control = [ "100.0.0.0/8 allow" ];
        
        local-zone = [''"your.domain.com." redirect''];
        local-data = [''"your.domain.com. IN A 100.128.23.128"''];
        local-data-ptr = [''"100.128.23.128 your.domain.com"''];
      };
    };
  };
}
```

Requests towards `your.domain.com` and all subdomains within the vpn will now get the answer `100.128.23.128`, which is the _tailnet_ ip address of our server. 

{{< callout emoji="⚡️" text="You can check the ip address of your server in the tailscale admin console under 'Machines' -> 'Addresses'." >}}

For our dns resolver to work properly, we now have to open the port on the tailscale interface of the server. The default DNS ports are `53` for `TCP` and `UDP`. Tailscale does not allow other ports than the default on their admin console.

```nix {hl_lines=["3-6"]}
{ pkgs, config, ... }:
{
  networking.firewall.interfaces."${config.services.tailscale.interfaceName}" = {
    allowedTCPPorts = [ 53 ];
    allowedUDPPorts = [ 53 ];
  };
  
  services.unbound = {
    enable = true;
    resolveLocalQueries = false;
    
    settings = {
      server = {
        interface = [ "${config.services.tailscale.interfaceName}" ];
        access-control = [ "100.0.0.0/8 allow" ];
        
        local-zone = [''"your.domain.com." redirect''];
        local-data = [''"your.domain.com. IN A 100.128.23.128"''];
        local-data-ptr = [''"100.128.23.128 your.domain.com"''];
      };
    };
  };
}
```
We're again using the name directly from the configuration with `config.services.tailscale.interfaceName` to avoid potential spelling mistakes or answer to changes in the naming convention of the tailscale package.

## Setting up Split-DNS in tailscale
Now that the dns resolver is set up, we need to register it in tailscale so requests with this domain suffix get their response with the _tailnet_ ip address from
the private DNS resolver and not the local ip address we set up in the global DNS.

This is straight forward in the [DNS tab of the admin console](https://login.tailscale.com/admin/dns) under ***Nameservers***.
We then select ***Custom...*** after clicking ***Add nameserver***.

{{<figure src="https://i.imgur.com/3OznQId.png" title="Popup with 'Restrict to domain' setting">}}

Here we enter the domain of our server as *Nameserver*, in my case `100.128.23.128`, select ***Restrict to domain*** and enter the domain `your.domain.com`.
{{< callout emoji="⚡️" text="Make sure you have entries in 'Global nameservers' and selected 'Override local DNS' to force these settings on the client when being connected with tailscale." >}}

## Testing the dns resolution
There are several tools to confirm our configuration, one option is the console lookup utility [dig](https://linux.die.net/man/1/dig) which also allows to configure a specific nameserver to request a response from (good to know, we won't need it tho).

Let's check while we're connected with tailscale:
```text {hl_lines=[8]}
$ dig jellyfin.your.domain.com

;; OPT PSEUDOSECTION:
;; QUESTION SECTION:
;jellyfin.your.domain.com.	IN	A

;; ANSWER SECTION:
jellyfin.your.domain.com. 3600 IN	A	100.128.23.128
```
When asking for `jellyfin.your.domain.com`, one of our services on the wildcard domain `your.domain.com`, we get back `100.128.23.128` as answer, which is our homeserver with the ip address within the vpn. Nice.

Let's check if it still works within the local network! After disconnecting tailscale on our local machine, we run the same command again.
```text {hl_lines=[8]}
$ dig jellyfin.your.domain.com

;; OPT PSEUDOSECTION:
;; QUESTION SECTION:
;jellyfin.your.domain.com.	IN	A

;; ANSWER SECTION:
jellyfin.your.domain.com. 3600 IN	A	192.168.2.72
```
And yes! We receive the local address `192.168.2.72` from the global DNS resolver (Cloudflare).
This confirms, that our setup works! *If it doesn't work for you, please check your configuration again and don't hesitate to ask in the comments.*

{{< callout emoji="⚡️" text="Positive side effect: We also have a https connection to the services with our generated SSL certificates inside the vpn now." >}}

You can further confirm this by using your phone, switching off Wi-Fi and trying to connect to `jellyfin.your.domain.com` while being connected with tailscale. It should send you directly to the login screen of Jellyfin on an encrypted https connection.

That's it! Thanks for reading <3

- [My otterden repo](https://codeberg.org/aottr/otterden)
- [My Split-DNS config](https://codeberg.org/aottr/otterden/src/branch/main/nixos/ferret/tailscale-splitdns.nix)