import { loadRacketCatalog, loadStringCatalog, DATASET_VERSION } from '@/data/load';
import { scoreRackets } from '@/recommendation/normalize/racket-attributes';
import { recommend, enrichProfileWithCatalog, buildCatalogScale } from '@/recommendation';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { emptyAnswers, type QuestionnaireAnswers } from '@/recommendation/profile/answers';
const rackets = scoreRackets(loadRacketCatalog()); const strings = loadStringCatalog();
const esc = buildCatalogScale(rackets);
const BASE: Partial<QuestionnaireAnswers> = {
  age: 38, height_cm: 178, weight_kg: 80, dominant_hand: 'destro', sex: 'masculino',
  perceived_strength: 'media', fitness_level: 'bom', experience_duration: 'mais_5a',
  frequency_per_week: 3, has_lessons: 'ja_fiz', plays_matches: 'sim',
  tournament_experience: 'amadores', perceived_level: 'intermediario',
  can_sustain_rally: 'sim', can_direct_ball: 'sim', can_generate_spin: 'as_vezes',
  can_vary_depth: 'as_vezes', reliable_second_serve: 'sim',
  play_style: ['saque_voleio'], forehand_type: 'topspin_moderado', backhand_hands: 'duas_maos',
  swing_length: 'medio', swing_speed: 'moderada', depth_control: 'as_vezes',
  ball_tendency: ['caem_curtas'], discomfort_areas: ['nenhum'],
  string_breakage: 'raramente', string_budget: 'equilibrado',
  missing_attributes: ['power','control','maneuverability'], objective: ['mais_potencia'],
  no_current_racket: true, current_racket_id: null,
};
const answers = { ...emptyAnswers(), ...BASE } as QuestionnaireAnswers;
const profile = enrichProfileWithCatalog(buildPlayerProfile(answers), rackets, strings);
const res = recommend({ profile, rackets, strings, datasetVersion:DATASET_VERSION, mode:'permissive', includeSetup:true });
console.log('pedido: potencia 1o, controle 2o, manobrabilidade 3o — sem spin\n');
for (const e of res.podium) {
  const a = e.racket.attributes, s = e.racket.variant.specs;
  const pc=(k:string)=>Math.round(esc.position(k as never, a[k as keyof typeof a] as number));
  console.log(`  ${e.rank}o ${e.racket.variant.product_name.padEnd(36)} ${s.unstrung_weight_g}g RA${s.ra_stiffness} match ${e.fit_score.toFixed(1)}`);
  console.log(`      pot:${pc('power_score')}  ctrl:${pc('control_score')}  spin:${pc('spin_score')}  manob:${pc('maneuverability_score')}`);
}
