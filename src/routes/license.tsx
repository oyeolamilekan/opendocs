import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Brand } from "../components/brand";
import { Card } from "../components/ui/card";
import { ThemeToggle } from "../components/theme-toggle";
import { seoLinks, seoMeta, siteUrl } from "../lib/seo";

export const Route = createFileRoute("/license")({
  head: () => {
    const url = siteUrl("/license");
    return {
      meta: seoMeta({
        title: "MIT License",
        description:
          "MIT License for openapidoc, an open-source API documentation platform for developers and AI agents.",
        url,
      }),
      links: seoLinks({ url }),
    };
  },
  component: License,
});

const licenseParagraphs = [
  "Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:",
  "The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.",
  "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.",
];

function License() {
  return (
    <main className="min-h-screen px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Brand />
          <ThemeToggle />
        </div>
        <Card className="mt-8 p-7 sm:p-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
          <h1 className="mt-8 text-3xl font-bold tracking-tight">
            MIT License
          </h1>
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            Copyright (c) 2026 Oye Olalekan Johnson
          </p>
          <div className="mt-6 space-y-5 text-sm leading-7 text-muted-foreground">
            {licenseParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
