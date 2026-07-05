import ExpenseTracker from "./components/ExpenseTracker";
import { getPeople } from "@/lib/people";

// Read the PEOPLE env var at request time so name changes don't require a rebuild.
export const dynamic = "force-dynamic";

export default function Home() {
  const people = getPeople();
  return <ExpenseTracker people={people} />;
}
