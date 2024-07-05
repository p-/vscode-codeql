import { useCallback } from "react";
import { styled } from "styled-components";
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { Codicon } from "./icon";

const TextField = styled(VSCodeTextField)`
  width: 100%;
`;

type Props = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;

  className?: string;
};

export const MaxThreadFlowStepsBox = ({
  value,
  placeholder,
  onChange,
  className,
}: Props) => {
  const handleInput = useCallback(
    (e: InputEvent) => {
      const target = e.target as HTMLInputElement;

      onChange(target.value);
    },
    [onChange],
  );

  return (
    <TextField
      placeholder={placeholder}
      value={value}
      type="number"
      onInput={handleInput}
      className={className}
    >
      <Codicon name="list-selection" label="Limit" slot="start" />
    </TextField>
  );
};
