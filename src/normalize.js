const NAME_FORMATTER = new Intl.ListFormat("en-US", {
  style: "long",
  type: "conjunction",
});

export function formatNameList(names) {
  if (!names || names.length === 0) return null;
  return NAME_FORMATTER.format(names);
}
