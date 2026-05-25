import {
  AntiguedadCalculoFormCard,
  AntiguedadExternaCard,
  AntiguedadIntroCard,
  AntiguedadResultadoCard,
  useAntiguedadPage,
} from "../features/rrhh/antiguedad/index.js";

export default function Antiguedad() {
  const { calculoCardProps, externaCardProps, resultadoCardProps } = useAntiguedadPage();

  return (
    <div className="min-h-full px-4 py-6 md:px-6 md:py-8 lg:px-8 print:max-w-none print:px-4 print:py-3">
      <div className="mx-auto w-full max-w-6xl space-y-4 print:max-w-none">
        <AntiguedadIntroCard />

        <AntiguedadCalculoFormCard {...calculoCardProps} />

        <AntiguedadExternaCard {...externaCardProps} />

        {resultadoCardProps ? <AntiguedadResultadoCard {...resultadoCardProps} /> : null}
      </div>
    </div>
  );
}
