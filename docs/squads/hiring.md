# Hiring a Squad

When you ask Io to hire a squad for a repository, an automated analysis and team generation process begins.

## Process

### 1. Repository Analysis

Io clones or inspects the repository to understand:

- Programming languages used
- Frameworks and libraries
- Project structure and patterns
- Existing CI/CD, tests, documentation

### 2. Team Generation

Based on the analysis, the LLM proposes a team composition:

- **Team Lead** (always included)
- **QA Agent** (always included)
- **2-4 specialists** tailored to the repo

Example for a React + Node.js app:

| Role | Expertise |
|------|-----------|
| Team Lead | Project coordination, architecture |
| Frontend Developer | React, TypeScript, CSS |
| API Engineer | Node.js, Express, databases |
| DevOps | CI/CD, Docker, deployment |
| QA Agent | Testing, code review, quality |

### 3. User Approval

Io presents the proposed team for your approval:

```
Io: "I'd like to hire the following squad for my-app:
     - Team Lead
     - Frontend Developer (React/TS specialist)
     - API Engineer (Node.js/Express)
     - QA Agent

     Shall I proceed?"

You: "Yes, but add a DevOps role too"

Io: "Done! Squad hired with 5 members."
```

### 4. Squad Activation

Once approved:
- Squad and members stored in the database
- All future messages about that repo route to the squad
- Squad appears in the web dashboard

## Customization

After hiring, you can:

- Add or remove members
- Change the PR mode
- Configure MCP servers
- Update squad settings

```
"Add a documentation writer to the my-app squad"
"Set the my-app squad to draft-pr mode"
```
