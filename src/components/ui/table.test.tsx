// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

describe("Table", () => {
  it("renders semantic table parts with a styleable responsive container", () => {
    render(
      <Table containerClassName="rounded-xl border" aria-label="Example table">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Acme</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const table = screen.getByRole("table", { name: "Example table" });
    expect(table).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "Acme" })).toBeTruthy();
    expect(table.parentElement?.dataset.slot).toBe("table-container");
    expect(table.parentElement?.className).toContain("rounded-xl");
    expect(table.parentElement?.className).toContain("overflow-x-auto");
  });
});
