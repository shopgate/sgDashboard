sgDashboard
=========================

##Availible Interfaces
- [Jira](https://www.atlassian.com/software/jira)
- [Zendesk](https://www.zendesk.com/)
- [Inopla](https://www.inopla.de/)

##Requirements
This project use the following dependences:
- NodeJS
- Typescript
- MongoDB
- Redis


##How to install

The easiest way to get started is to clone the repository:

```bash
$ git clone git@github.com:shopgate/sgDashboard.git
$ cd sgDashboard
```
---
sgDashboard is completly written in [Typescript](http://www.typescriptlang.org/).
So we need to install Typescript first and transcode the code
```bash
$ sudo npm install -g typescript
$ tsc 
```

##How to configurate

To configurate just copy the `config.default.json` to `config.json` and edit it:
```bash
$ cp config/config.default.json config/config.json
$ vi sgDashboard
```










