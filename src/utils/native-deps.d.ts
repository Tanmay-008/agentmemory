declare module "better-sqlite3" {
  const Database: any;
  export default Database;
}

declare module "sqlite-vec" {
  export function load(db: any): void;
}
