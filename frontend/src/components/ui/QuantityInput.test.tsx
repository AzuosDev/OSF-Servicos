import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { clampQuantity, MAX_QUANTITY, QuantityInput } from "./QuantityInput";

/** Espelha o uso real: o pai guarda a quantidade e o campo só a reporta. */
function Harness({ initial = 1, onChange }: { initial?: number; onChange?: (q: number) => void }) {
  const [quantity, setQuantity] = useState(initial);
  return (
    <div>
      <QuantityInput
        value={quantity}
        onChange={(q) => {
          setQuantity(q);
          onChange?.(q);
        }}
        label="Quantidade de Lavagem"
      />
      <span data-testid="quantity">{quantity}</span>
    </div>
  );
}

const field = () => screen.getByLabelText("Quantidade de Lavagem") as HTMLInputElement;
const reported = () => screen.getByTestId("quantity").textContent;

describe("clampQuantity", () => {
  it("keeps an integer inside the accepted range", () => {
    expect(clampQuantity(100)).toBe(100);
    expect(clampQuantity(1)).toBe(1);
  });

  it("pulls values below the minimum and above the maximum back into range", () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-5)).toBe(1);
    expect(clampQuantity(MAX_QUANTITY + 1)).toBe(MAX_QUANTITY);
  });

  it("truncates fractions and falls back to the minimum for non-numbers", () => {
    expect(clampQuantity(3.9)).toBe(3);
    expect(clampQuantity(Number.NaN)).toBe(1);
  });

  it("honours an explicit minimum, used by the '-' button to reach zero and remove the item", () => {
    expect(clampQuantity(0, 0)).toBe(0);
  });
});

describe("QuantityInput", () => {
  it("reports the whole number that was typed", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.change(field(), { target: { value: "100" } });

    expect(field().value).toBe("100");
    expect(reported()).toBe("100");
    expect(onChange).toHaveBeenLastCalledWith(100);
  });

  it("lets the field be cleared while typing without changing the quantity", () => {
    render(<Harness initial={1} />);

    fireEvent.change(field(), { target: { value: "" } });

    expect(field().value).toBe("");
    expect(reported()).toBe("1");
  });

  it("goes from 1 to 25 the way a user does: clear, then type", () => {
    render(<Harness initial={1} />);

    fireEvent.change(field(), { target: { value: "" } });
    fireEvent.change(field(), { target: { value: "2" } });
    fireEvent.change(field(), { target: { value: "25" } });

    expect(field().value).toBe("25");
    expect(reported()).toBe("25");
  });

  it("restores the current quantity when the field is left empty on blur", () => {
    render(<Harness initial={4} />);

    fireEvent.change(field(), { target: { value: "" } });
    fireEvent.blur(field());

    expect(field().value).toBe("4");
    expect(reported()).toBe("4");
  });

  it("never reports zero, and blur brings the previous quantity back", () => {
    const onChange = vi.fn();
    render(<Harness initial={3} onChange={onChange} />);

    fireEvent.change(field(), { target: { value: "0" } });

    expect(reported()).toBe("3");
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(field());
    expect(field().value).toBe("3");
  });

  it("ignores anything that is not a digit", () => {
    render(<Harness initial={1} />);

    fireEvent.change(field(), { target: { value: "1e5" } });

    expect(field().value).toBe("15");
    expect(reported()).toBe("15");
  });

  it("drops leading zeros instead of building 0100", () => {
    render(<Harness initial={1} />);

    fireEvent.change(field(), { target: { value: "0100" } });

    expect(field().value).toBe("100");
    expect(reported()).toBe("100");
  });

  it("accepts quantities well past four digits", () => {
    render(<Harness initial={1} />);

    fireEvent.change(field(), { target: { value: "99999" } });

    expect(field().value).toBe("99999");
    expect(reported()).toBe("99999");
  });

  it("caps the typed quantity, showing the same number that will be charged", () => {
    render(<Harness initial={1} />);

    fireEvent.change(field(), { target: { value: String(MAX_QUANTITY + 1) } });

    expect(field().value).toBe(String(MAX_QUANTITY));
    expect(reported()).toBe(String(MAX_QUANTITY));
  });

  it("follows the parent when the quantity changes elsewhere, such as the '+' button", () => {
    function Stepper() {
      const [quantity, setQuantity] = useState(1);
      return (
        <div>
          <QuantityInput value={quantity} onChange={setQuantity} label="Quantidade de Lavagem" />
          <button type="button" onClick={() => setQuantity((q) => q + 1)}>
            mais
          </button>
        </div>
      );
    }
    render(<Stepper />);

    fireEvent.click(screen.getByRole("button", { name: "mais" }));

    expect(field().value).toBe("2");
  });

  it("drops what was typed when the '+' button changes the quantity before any blur", () => {
    function Stepper() {
      const [quantity, setQuantity] = useState(1);
      return (
        <div>
          <QuantityInput value={quantity} onChange={setQuantity} label="Quantidade de Lavagem" />
          <button type="button" onClick={() => setQuantity((q) => q + 1)}>
            mais
          </button>
          <span data-testid="quantity">{quantity}</span>
        </div>
      );
    }
    render(<Stepper />);

    fireEvent.change(field(), { target: { value: "10" } });
    expect(field().value).toBe("10");

    fireEvent.click(screen.getByRole("button", { name: "mais" }));

    expect(reported()).toBe("11");
    expect(field().value).toBe("11");
  });
});
