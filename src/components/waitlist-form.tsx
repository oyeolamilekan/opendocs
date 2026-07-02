import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { ArrowRight } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { getErrorMessage } from "../lib/errors";
import { Button } from "./ui/button";
import { FieldGroup } from "./ui/field";
import { Input } from "./ui/input";
import { useToast } from "./ui/toast";

export function WaitlistForm() {
  const join = useMutation(api.waitlist.join);
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await join({
        email,
        website,
        source: "landing-page",
      });
      toast.success(
        result.alreadyJoined
          ? "You are already on the waitlist"
          : "You have joined the waitlist",
      );
      setEmail("");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to join the waitlist"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-8 max-w-lg"
    >
      <FieldGroup className="gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="waitlist-email">
          Email address
        </label>
        <Input
          id="waitlist-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          required
          className="h-12 flex-1"
        />
        <div className="absolute -left-[10000px]" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
        <Button type="submit" className="h-12 px-5" disabled={isSubmitting}>
          {isSubmitting ? "Joining..." : "Join waitlist"}
          <ArrowRight className="size-4" />
        </Button>
      </FieldGroup>
    </form>
  );
}
