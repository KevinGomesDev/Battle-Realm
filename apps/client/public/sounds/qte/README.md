# Sons de QTE (Quick Time Event)

## Arquivos Necessários

| Arquivo             | Duração       | Formato | Descrição                                                                   |
| ------------------- | ------------- | ------- | --------------------------------------------------------------------------- |
| `qte-start.mp3`     | **0.3-0.5s**  | MP3/OGG | Som de ativação quando QTE aparece. Sugestão: "whoosh" ou "power up" curto. |
| `qte-tick.mp3`      | **0.05-0.1s** | MP3/OGG | Tick suave de contagem (reservado para uso futuro).                         |
| `qte-countdown.mp3` | **0.2-0.3s**  | MP3/OGG | Bip de urgência tocado nos últimos 30% do tempo. Sugestão: beep agudo.      |
| `qte-perfect.mp3`   | **0.5-0.8s**  | MP3/OGG | Som épico para acerto PERFEITO. Sugestão: chime brilhante, fanfarra curta.  |
| `qte-hit.mp3`       | **0.3-0.5s**  | MP3/OGG | Som de acerto normal. Sugestão: "ding" satisfatório.                        |
| `qte-miss.mp3`      | **0.4-0.6s**  | MP3/OGG | Som de falha/erro. Sugestão: buzzer, "wrong answer".                        |
| `qte-block.mp3`     | **0.3-0.5s**  | MP3/OGG | Som de bloqueio bem-sucedido. Sugestão: escudo metálico, impacto sólido.    |

## Especificações Técnicas

- **Formato**: MP3 (com fallback OGG para compatibilidade)
- **Bit Rate**: 128-192 kbps
- **Sample Rate**: 44.1 kHz
- **Canais**: Mono ou Stereo
- **Normalização**: -3dB a -6dB para evitar clipping

## Onde Cada Som Toca

1. **qte-start.mp3**: Quando o QTE aparece na tela
2. **qte-countdown.mp3**: Quando o indicador atinge 70% (últimos 30% do tempo)
3. **qte-perfect.mp3**: Quando o jogador acerta na zona PERFEITA
4. **qte-hit.mp3**: Quando o jogador acerta na zona de HIT
5. **qte-miss.mp3**: Quando o jogador erra ou não responde a tempo
6. **qte-block.mp3**: Quando o jogador faz BLOCK perfeito (tecla E na zona perfeita)

## Sugestões de Assets Gratuitos

- [Freesound.org](https://freesound.org) - CC0 e Creative Commons
- [OpenGameArt.org](https://opengameart.org) - Assets de jogos open source
- [Mixkit.co](https://mixkit.co) - Sons gratuitos
- [Zapsplat.com](https://www.zapsplat.com) - Biblioteca gratuita com registro
