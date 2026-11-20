export class ButtonPartial {
  static render(text: string, url: string, color: string, isSmall = false) {
    const padding = isSmall ? '10px 20px' : '14px 30px';
    const fontSize = isSmall ? '13px' : '15px';
    
    return `
      <div style="margin: 24px 0; text-align: center;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:${isSmall ? '40px' : '50px'};v-text-anchor:middle;width:200px;" arcsize="16%" stroke="f" fillcolor="${color}">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:sans-serif;font-size:${fontSize};font-weight:bold;">${text}</center>
        </v:roundrect>
        <![endif]-->
        <a href="${url}" target="_blank"
          style="
            background-color: ${color};
            color: #ffffff;
            padding: ${padding};
            font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
            font-size: ${fontSize};
            font-weight: 600;
            text-decoration: none;
            border-radius: 8px;
            display: inline-block;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
            border: 1px solid ${color};
            text-align: center;
          ">
          ${text}
        </a>
      </div>
    `;
  }
}
