# LoLQuiz

## Getting Started

After cloning this repository, follow these steps to set up your development environment:

1. **Install dependencies:**
   ```sh
   npm install
   ```
   This will install all required packages, including Prisma and the Prisma client.

2. **Generate the Prisma client:**
   ```sh
   npx prisma generate
   ```
   This command generates the Prisma client based on your schema. (If you see errors about missing Prisma client, be sure to run this step.)

3. **Start the development server:**
   ```sh
   npm run dev
   ```

---

### Notes
- Ensure both `prisma` (devDependency) and `@prisma/client` (dependency) are listed in your `package.json`.
- If you add or change your Prisma schema, always re-run `npx prisma generate`.
- If you want Prisma to generate the client automatically after every install, add this to your `package.json` scripts:
  ```json
  "postinstall": "prisma generate"
  ```
- For more information, see the [Prisma documentation](https://www.prisma.io/docs/).
