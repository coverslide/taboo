module.exports = SoundEx


 /*
  * v 1.0d  TESTED-OK  20060112
  * -----------------------
  *
  * The following SoundEx function is:
  * 
  *    (C) Copyright 2002 - 2006, Creativyst, Inc.
  *               ALL RIGHTS RESERVED
  * 
  * For more information go to:
  *           http://www.Creativyst.com
  * or email:
  *           Support@Creativyst.com
  * 
  * Redistribution and use in source and binary 
  * forms, with or without modification, are 
  * permitted provided that the following conditions 
  * are met: 
  * 
  *   1. Redistributions of source code must 
  *      retain the above copyright notice, this 
  *      list of conditions and the following 
  *      disclaimer. 
  * 
  *   2. Redistributions in binary form must 
  *      reproduce the above copyright notice, 
  *      this list of conditions and the 
  *      following disclaimer in the 
  *      documentation and/or other materials 
  *      provided with the distribution. 
  * 
  *   3. All advertising materials mentioning 
  *      features or use of this software must 
  *      display the following acknowledgement: 
  *      This product includes software developed 
  *      by Creativyst, Inc. 
  * 
  *   4. The name of Creativyst, Inc. may not be 
  *      used to endorse or promote products 
  *      derived from this software without 
  *      specific prior written permission. 
  * 
  * THIS SOFTWARE IS PROVIDED BY CREATIVYST CORPORATION
  * ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES,
  * INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
  * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
  * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL
  * THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, 
  * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL 
  * DAMAGES (INCLUDING, BUT NOT LIMITED TO, 
  * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS 
  * OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
  * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
  * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY
  * WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
  * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. 
  *
 */
  function SoundEx(WordString, LengthOption, CensusOption)
  {
      var TmpStr;
      var WordStr = "";
      var CurChar;
      var LastChar;
      var SoundExLen = 10;
      var WSLen;
      var FirstLetter;

      if(CensusOption) {
          LengthOption = 4;
      }

      if(LengthOption != undefined) {
          SoundExLen = LengthOption;
      }
      if(SoundExLen > 10) {
          SoundExLen = 10;
      }
      if(SoundExLen < 4) {
          SoundExLen = 4;
      }

      if(!WordString) {
          return("");
      }

      WordString = WordString.toUpperCase();

      /* Clean and tidy
      */
      WordStr = WordString;


      WordStr = WordStr.replace(/[^A-Z]/gi, " "); // rpl non-chars w space
      WordStr = WordStr.replace(/^\s*/g, "");     // remove leading space
      WordStr = WordStr.replace(/\s*$/g, "");     // remove trailing space



      if(!CensusOption) {
          /* Some of our own improvements
          */
          WordStr = WordStr.replace(/DG/g, "G");     // Change DG to G
          WordStr = WordStr.replace(/GH/g, "H");     // Change GH to H
          WordStr = WordStr.replace(/GN/g, "N");     // Change GN to N
          WordStr = WordStr.replace(/KN/g, "N");     // Change KN to N
          WordStr = WordStr.replace(/PH/g, "F");     // Change PH to F
          WordStr =
              WordStr.replace(/MP([STZ])/g, "M$1"); // MP if fllwd by ST|Z
          WordStr = WordStr.replace(/^PS/g, "S");   // Chng leadng PS to S
          WordStr = WordStr.replace(/^PF/g, "F");   // Chng leadng PF to F
          WordStr = WordStr.replace(/MB/g, "M");    // Chng MB to M
          WordStr = WordStr.replace(/TCH/g, "CH");  // Chng TCH to CH
      }





      /* The above improvements
       * may change this first letter
      */
      FirstLetter = WordStr.substr(0,1);


      /* in case 1st letter is
       * an H or W and we're in
       * CensusOption = 1
      */
      if(FirstLetter == "H" || FirstLetter == "W") {
          TmpStr = WordStr.substr(1);
          WordStr = "-";
          WordStr += TmpStr;
      }


      /* In properly done census
       * SoundEx the H and W will
       * be squezed out before
       * performing the test
       * for adjacent digits
       * (this differs from how
       * 'real' vowels are handled)
      */
      if(CensusOption == 1) {
          WordStr = WordStr.replace(/[HW]/g, ".");
      }


      /* Begin Classic SoundEx
      */
      WordStr =  WordStr.replace(/[AEIOUYHW]/g, "0");
      WordStr = WordStr.replace(/[BPFV]/g, "1");
      WordStr = WordStr.replace(/[CSGJKQXZ]/g, "2");
      WordStr = WordStr.replace(/[DT]/g, "3");
      WordStr = WordStr.replace(/[L]/g, "4");
      WordStr = WordStr.replace(/[MN]/g, "5");
      WordStr = WordStr.replace(/[R]/g, "6");



      /* Properly done census:
       * squeze H and W out
       * before doing adjacent
       * digit removal.
      */
      if(CensusOption == 1) {
          WordStr = WordStr.replace(/\./g, "");
      }



      /* Remove extra equal adjacent digits
      */
      WSLen = WordStr.length;
      LastChar = "";
      TmpStr = "";
      // removed v10c djr:  TmpStr = "-";  /* rplcng skipped first char */

      for(i = 0; i < WSLen; i++) {
          CurChar = WordStr.charAt(i);
          if(CurChar == LastChar) {
              TmpStr += " ";
          }
          else {
              TmpStr += CurChar;
              LastChar = CurChar;
          }
      }
      WordStr = TmpStr;


      WordStr = WordStr.substr(1);          /* Drop first letter code   */
      WordStr = WordStr.replace(/\s/g, ""); /* remove spaces            */
      WordStr = WordStr.replace(/0/g, "");  /* remove zeros             */
      WordStr += "0000000000";              /* pad with zeros on right  */

      WordStr = FirstLetter + WordStr;      /* Add first letter of word */

      WordStr = WordStr.substr(0,SoundExLen); /* size to taste     */

      return(WordStr);
  }
